import type { ArquivoMidi } from "./midi";

/** Uma nota já convertida para o grid: coluna e duração em colunas. */
export interface NotaGrid {
  /** número MIDI, após transposição */
  m: number;
  /** coluna inicial no grid */
  c: number;
  /** duração em colunas */
  l: number;
}

export interface OpcoesQuantizacao {
  /** divisor da Propriedade de Nota (1=1/4, 2=1/8, 4=1/16, 8=1/32, 16=1/64) */
  divisor: number;
  /** espaços do grid por compasso, conforme o Ritmo escolhido no editor */
  espacosPorCompasso: number;
  /** semitons de transposição */
  transpor: number;
}

export interface ResultadoQuantizacao {
  notas: NotaGrid[];
  compassos: number;
}

/**
 * Converte as faixas ativas de um MIDI em notas de grid, quantizadas para a grade do BDO.
 * Notas repetidas na mesma coluna/tecla (comum quando duas faixas dobram a mesma linha)
 * são deduplicadas — o clique no jogo é um só.
 */
export function quantizar(src: ArquivoMidi, opcoes: OpcoesQuantizacao): ResultadoQuantizacao {
  const { divisor, espacosPorCompasso, transpor } = opcoes;
  let notas: NotaGrid[] = [];

  src.tracks.forEach((track) => {
    if (!track.on) return;
    track.notes.forEach((n) => {
      notas.push({
        m: n.m + transpor,
        c: Math.round((n.t / src.div) * divisor),
        l: Math.max(1, Math.round((n.d / src.div) * divisor)),
      });
    });
  });

  const vistos = new Set<string>();
  notas = notas.filter((n) => {
    const chave = `${n.m}|${n.c}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
  notas.sort((a, b) => a.c - b.c || a.m - b.m);

  const alcance = notas.length ? Math.max(...notas.map((n) => n.c + n.l)) : 0;
  const compassos = Math.max(1, Math.ceil(alcance / espacosPorCompasso));

  return { notas, compassos };
}

/**
 * Move uma nota por oitavas inteiras (±12 semitons) até caber em [lo, hi], escolhendo o menor
 * deslocamento possível. Preserva a nota da escala — diferente de Transpor, que desloca tudo
 * pelo mesmo número de semitons e muda a tonalidade da peça inteira. Se o alcance for menor que
 * uma oitava (caso extremo, praticamente nunca acontece com os instrumentos do jogo), devolve a
 * nota original sem tentar forçar.
 */
function dobrarNotaParaAlcance(m: number, lo: number, hi: number): number {
  if (lo > hi || (m >= lo && m <= hi)) return m;
  let melhor = m;
  let menorDeslocamento = Infinity;
  for (let oitavas = -8; oitavas <= 8; oitavas++) {
    const candidato = m + 12 * oitavas;
    if (candidato >= lo && candidato <= hi && Math.abs(oitavas) < menorDeslocamento) {
      menorDeslocamento = Math.abs(oitavas);
      melhor = candidato;
    }
  }
  return melhor;
}

/**
 * Dobra por oitava todas as notas fora de [lo, hi]. Pode criar colisões novas (duas notas que
 * eram uma oitava distantes viram a mesma tecla na mesma coluna) — dedupe de novo depois.
 */
export function dobrarParaAlcance(notas: NotaGrid[], alcance: { lo: number; hi: number }): NotaGrid[] {
  const dobradas = notas.map((n) => ({ ...n, m: dobrarNotaParaAlcance(n.m, alcance.lo, alcance.hi) }));
  const vistos = new Set<string>();
  return dobradas.filter((n) => {
    const chave = `${n.m}|${n.c}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

/** Notas de um compasso, agrupadas por coluna (para o modo cópia e a lista de cliques). */
export interface ColunaDoCompasso {
  /** coluna dentro do compasso (0-indexed) */
  c: number;
  /** teclas dessa coluna, em ordem crescente */
  ms: number[];
}

/** Largura de coluna (px) que o grid usa para caber ~980px de tela, clampada entre 11 e 26px. */
export function larguraColuna(cols: number): number {
  return Math.max(11, Math.min(26, Math.floor(980 / Math.max(cols, 1))));
}

export function colunasDoCompasso(notas: NotaGrid[], compasso: number, espacosPorCompasso: number): ColunaDoCompasso[] {
  const mapa = new Map<number, number[]>();
  notas
    .filter((n) => Math.floor(n.c / espacosPorCompasso) === compasso)
    .forEach((n) => {
      const chave = n.c % espacosPorCompasso;
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(n.m);
    });
  return [...mapa.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([c, ms]) => ({ c, ms: ms.sort((x, y) => x - y) }));
}
