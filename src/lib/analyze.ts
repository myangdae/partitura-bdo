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

  return {
    totalNotas: notas.length,
    compassos,
    alcanceUsado,
    foraDoAlcance,
    passouDoLimite,
    avisos,
  };
}
