/**
 * Constantes verificadas por inspeção direta do editor de composição do BDO.
 * Não alterar sem confirmar no jogo de novo — ver BRIEFING.md.
 */

export const RITMOS = ["3/4", "4/4", "6/8"] as const;
export type Ritmo = (typeof RITMOS)[number];

/** Espaços de 1/8 observados entre dois números da régua, por Ritmo. */
export const PERBAR_POR_RITMO: Record<Ritmo, number> = {
  "3/4": 6,
  "4/4": 8,
  "6/8": 12,
};

export const PROPRIEDADES_DE_NOTA = [
  { label: "1/4", divisor: 1 },
  { label: "1/8", divisor: 2 },
  { label: "1/16", divisor: 4 },
  { label: "1/32", divisor: 8 },
  { label: "1/64", divisor: 16 },
] as const;

export const ESTILOS = ["Sustenido", "Pedal de Sustentação"] as const;
export type Estilo = (typeof ESTILOS)[number];

/** Teto mostrado como "x/10000" no contador do editor — não é o limite real de salvamento. */
export const CONTADOR_MAXIMO = 10000;

export type Conjunto = "Para Novato" | "Florquestra" | "Marnis";

export interface Instrumento {
  nome: string;
  conjunto: Conjunto;
  /** true quando o conjunto normalmente não está desbloqueado (aparece em cinza no jogo). */
  bloqueadoPorPadrao?: boolean;
}

export type Categoria = "Flauta" | "Violinos" | "Piano Elétrico" | "Percussão";

/** Catálogo completo, levantado nos prints do diálogo "Adicionar Instrumento". */
export const INSTRUMENTOS: Record<Categoria, Instrumento[]> = {
  Flauta: [
    { nome: "Flauta Transversal", conjunto: "Para Novato" },
    { nome: "Gravador", conjunto: "Para Novato" },
    { nome: "Flauta Transversal", conjunto: "Florquestra" },
    { nome: "Clarinete", conjunto: "Florquestra" },
    { nome: "Trompa", conjunto: "Florquestra" },
  ],
  Violinos: [
    { nome: "Outros", conjunto: "Para Novato" },
    { nome: "Harpa", conjunto: "Para Novato" },
    { nome: "Violino", conjunto: "Para Novato" },
    { nome: "Violão Acústico", conjunto: "Florquestra" },
    { nome: "Contrabaixo", conjunto: "Florquestra" },
    { nome: "Harpa", conjunto: "Florquestra" },
    { nome: "Violino", conjunto: "Florquestra" },
    { nome: "Marnibass", conjunto: "Marnis", bloqueadoPorPadrao: true },
    { nome: "Guitarra Elétrica: Onda Prateada", conjunto: "Marnis", bloqueadoPorPadrao: true },
    { nome: "Guitarra Elétrica: Highway", conjunto: "Marnis", bloqueadoPorPadrao: true },
    { nome: "Guitarra Elétrica: Hexe Glam", conjunto: "Marnis", bloqueadoPorPadrao: true },
  ],
  "Piano Elétrico": [
    { nome: "Piano", conjunto: "Para Novato" },
    { nome: "Piano", conjunto: "Florquestra" },
    { nome: "Marnion: Planeta Ondulado", conjunto: "Marnis", bloqueadoPorPadrao: true },
    { nome: "Marnion: Árvore Fantasiosa", conjunto: "Marnis", bloqueadoPorPadrao: true },
    { nome: "Marnion: Nota Secreta", conjunto: "Marnis", bloqueadoPorPadrao: true },
    { nome: "Marnion: Sanduíche", conjunto: "Marnis", bloqueadoPorPadrao: true },
  ],
  Percussão: [
    { nome: "Tambor", conjunto: "Para Novato" },
    { nome: "Prato", conjunto: "Para Novato" },
    { nome: "Kit de Bateria", conjunto: "Florquestra" },
    { nome: "Tamborim", conjunto: "Florquestra" },
  ],
};

/** Ainda não confirmado no jogo — ver "Ainda por confirmar" no BRIEFING. Tratar como chute. */
export const ALCANCE_PADRAO_CHUTADO = { lo: 36, hi: 96 };

const NOMES_NOTA = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const EH_SUSTENIDO = [false, true, false, true, false, false, true, false, true, false, true, false];

/** Nome da nota em número MIDI, no formato do jogo (só sustenidos, nunca bemol). */
export function nomeNota(midi: number): string {
  const classe = ((midi % 12) + 12) % 12;
  return NOMES_NOTA[classe] + (Math.floor(midi / 12) - 1);
}

export function ehSustenido(midi: number): boolean {
  const classe = ((midi % 12) + 12) % 12;
  return EH_SUSTENIDO[classe];
}

/** Rótulo único de um instrumento dentro do seletor de faixa. */
export function rotuloInstrumento(i: Instrumento): string {
  return `${i.nome} · ${i.conjunto}`;
}
