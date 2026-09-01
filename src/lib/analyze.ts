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

  return {
    totalNotas: notas.length,
    compassos,
    alcanceUsado,
    foraDoAlcance,
    passouDoLimite,
    avisos,
  };
}
