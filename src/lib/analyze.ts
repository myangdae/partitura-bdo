import type { NotaGrid } from "./quantize";

export interface Aviso {
  nivel: "bad" | "warn";
  texto: string;
}

export interface AnaliseOrcamento {
  totalNotas: number;
  compassos: number;
  alcanceUsado: { min: number; max: number } | null;
  foraDoAlcance: number;
  passouDoLimite: number;
  /** Índices (em `notas`) de notas estatisticamente atípicas — candidatas a ruído de transcrição. Heurística, não certeza. */
  indicesSuspeitos: Set<number>;
  avisos: Aviso[];
}

export interface OpcoesAnalise {
  limiteDeNotas: number;
  alcanceInstrumento: { lo: number; hi: number };
}

/** Mais de 4 oitavas de alcance é atípico pra uma linha melódica/harmônica de instrumento único. Limiar chutado por observação, não por dado do jogo. */
const SEMITONS_SUSPEITOS = 48;
/** Densidade de notas por compasso acima disso, combinada com alcance largo, é mais condizente com ruído de transcrição do que com uma linha melódica esparsa e só naturalmente grave. */
const NOTAS_POR_COMPASSO_SUSPEITAS = 5;
/** Amostra menor que isso é estatisticamente pequena demais pra quartis fazerem sentido. */
const MIN_NOTAS_PARA_DETECCAO = 8;

function quartil(valoresOrdenados: number[], p: number): number {
  const idx = (valoresOrdenados.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return valoresOrdenados[lo];
  return valoresOrdenados[lo] + (valoresOrdenados[hi] - valoresOrdenados[lo]) * (idx - lo);
}

/**
 * Marca notas cujo tom foge muito do aglomerado principal — método clássico de outlier por
 * quartis (cerca de Tukey, 1,5×IQR). É estatística sobre a altura da nota, não teoria musical:
 * não sabe se a nota "está certa", só que ela é atípica perto das outras. Serve pra apontar por
 * onde começar a limpeza manual de um MIDI convertido de áudio, nunca pra apagar sozinha.
 */
function detectarNotasSuspeitas(notas: NotaGrid[]): Set<number> {
  const indices = new Set<number>();
  if (notas.length < MIN_NOTAS_PARA_DETECCAO) return indices;

  const alturas = notas.map((n) => n.m).sort((a, b) => a - b);
  const q1 = quartil(alturas, 0.25);
  const q3 = quartil(alturas, 0.75);
  const iqr = q3 - q1;
  if (iqr < 1) return indices;

  const limiteBaixo = q1 - 1.5 * iqr;
  const limiteAlto = q3 + 1.5 * iqr;
  notas.forEach((n, i) => {
    if (n.m < limiteBaixo || n.m > limiteAlto) indices.add(i);
  });
  return indices;
}

/**
 * Orçamento de notas: cabe no grau de Talento Musical? cabe no alcance do instrumento?
 * Nenhum desses números é garantido pelo jogo — ver "Ainda por confirmar" no BRIEFING.
 */
export function analisarOrcamento(notas: NotaGrid[], compassos: number, opcoes: OpcoesAnalise): AnaliseOrcamento {
  const { limiteDeNotas, alcanceInstrumento } = opcoes;
  const foraDoAlcance = notas.filter((n) => n.m < alcanceInstrumento.lo || n.m > alcanceInstrumento.hi).length;
  const passouDoLimite = Math.max(0, notas.length - limiteDeNotas);

  const alcanceUsado = notas.length
    ? { min: Math.min(...notas.map((n) => n.m)), max: Math.max(...notas.map((n) => n.m)) }
    : null;

  const indicesSuspeitos = detectarNotasSuspeitas(notas);

  const avisos: Aviso[] = [];
  if (passouDoLimite > 0) {
    avisos.push({
      nivel: "bad",
      texto: `Passou ${passouDoLimite} notas. Desligue faixas, use uma grade maior (1/8 em vez de 1/16), ou suba de grau antes de salvar.`,
    });
  }
  if (foraDoAlcance > 0) {
    avisos.push({
      nivel: "warn",
      texto: `${foraDoAlcance} notas não cabem no instrumento. Ajuste a transposição até esse número zerar.`,
    });
  }
  if (alcanceUsado && compassos > 0) {
    const semitons = alcanceUsado.max - alcanceUsado.min;
    const notasPorCompasso = notas.length / compassos;
    if (semitons > SEMITONS_SUSPEITOS && notasPorCompasso > NOTAS_POR_COMPASSO_SUSPEITAS) {
      avisos.push({
        nivel: "warn",
        texto: `Alcance de ${(semitons / 12).toFixed(1)} oitavas com ${notas.length} notas em ${compassos} compassos tem cara de ruído de conversão de áudio, não de partitura original. Ritmo, Propriedade de Nota, Transpor e BPM só reorganizam a grade — nenhum deles remove notas erradas. Se esse MIDI veio de um conversor de MP3 genérico, tente limpar as notas soltas num editor como o MuseScore antes de importar aqui, ou gerar de novo com o Basic Pitch, que erra menos.`,
      });
    }
  }
  if (indicesSuspeitos.size > 0) {
    avisos.push({
      nivel: "warn",
      texto: `${indicesSuspeitos.size} nota(s) destacada(s) em roxo no grid está(ão) muito longe do aglomerado principal de altura — candidatas a erro de transcrição. É uma marcação estatística, não uma certeza: confira cada uma antes de decidir apagar.`,
    });
  }

  return {
    totalNotas: notas.length,
    compassos,
    alcanceUsado,
    foraDoAlcance,
    passouDoLimite,
    indicesSuspeitos,
    avisos,
  };
}
