/**
 * Parser de MusicXML (score-partwise) sem dependências, usando o DOMParser do navegador.
 * Lê pitch/duration/backup/forward — o suficiente pra virar a mesma estrutura que o parser de
 * MIDI produz, então entra na mesma pipeline de quantização. A ferramenta nunca escreve nada
 * de volta — só lê.
 *
 * Simplificações assumidas:
 * - Só score-partwise (o formato que MuseScore, Finale e Sibelius exportam na prática).
 * - `divisions` é tratado como constante pro arquivo inteiro — se mudar no meio (raro), a
 *   última leitura vale pra tudo.
 * - Notas ligadas por `<tie>` não são fundidas numa nota só: cada `<note>` vira um clique
 *   separado no grid, mesmo quando musicalmente é uma nota sustentada atravessando duas.
 */
import type { ArquivoMidi, FaixaMidi, NotaMidi } from "./midi";

const SEMITOM_DO_PASSO: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function pitchParaMidi(passo: string, alteracao: number, oitava: number): number {
  return (oitava + 1) * 12 + (SEMITOM_DO_PASSO[passo] ?? 0) + alteracao;
}

function textoDe(el: Element, seletor: string): string | null {
  return el.querySelector(seletor)?.textContent ?? null;
}

function numeroDe(el: Element, seletor: string): number | null {
  const t = textoDe(el, seletor);
  return t !== null && t !== "" ? Number(t) : null;
}

export function parseMusicXml(texto: string): ArquivoMidi {
  const doc = new DOMParser().parseFromString(texto, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Esse arquivo não é um MusicXML válido.");
  }

  const raiz = doc.documentElement;
  if (raiz.tagName !== "score-partwise") {
    throw new Error("Só leio MusicXML no formato score-partwise — o mais comum, usado pelo MuseScore e a maioria dos exportadores.");
  }

  const nomesPartes = new Map<string, string>();
  doc.querySelectorAll("part-list score-part").forEach((sp) => {
    const id = sp.getAttribute("id");
    const nome = textoDe(sp, "part-name");
    if (id) nomesPartes.set(id, nome && nome.trim() ? nome.trim() : id);
  });

  let divisions = 1;
  let tsn = 4;
  let tsd = 4;
  let tempo = 500000;

  const tracks: FaixaMidi[] = [];
  const partes = Array.from(doc.querySelectorAll("part"));
  if (!partes.length) throw new Error("Não achei nenhuma parte (instrumento) nesse MusicXML.");

  partes.forEach((parte) => {
    const id = parte.getAttribute("id") || "";
    const notes: NotaMidi[] = [];
    let cursor = 0;
    let inicioNotaBase = 0;

    parte.querySelectorAll("measure").forEach((medida) => {
      Array.from(medida.children).forEach((el) => {
        if (el.tagName === "attributes") {
          const div = numeroDe(el, "divisions");
          if (div) divisions = div;
          const beats = numeroDe(el, "time > beats");
          const beatType = numeroDe(el, "time > beat-type");
          if (beats) tsn = beats;
          if (beatType) tsd = beatType;
        } else if (el.tagName === "sound") {
          const t = el.getAttribute("tempo");
          if (t && Number(t) > 0) tempo = Math.round(60000000 / Number(t));
        } else if (el.tagName === "backup") {
          cursor -= numeroDe(el, "duration") || 0;
        } else if (el.tagName === "forward") {
          cursor += numeroDe(el, "duration") || 0;
        } else if (el.tagName === "note") {
          const duracao = numeroDe(el, "duration") || 0;
          const ehAcorde = !!el.querySelector("chord");
          const ehPausa = !!el.querySelector("rest");
          const inicio = ehAcorde ? inicioNotaBase : cursor;

          if (!ehPausa) {
            const pitchEl = el.querySelector("pitch");
            if (pitchEl) {
              const passo = textoDe(pitchEl, "step") || "C";
              const alteracao = numeroDe(pitchEl, "alter") || 0;
              const oitava = numeroDe(pitchEl, "octave") ?? 4;
              notes.push({ m: pitchParaMidi(passo, alteracao, oitava), t: inicio, d: Math.max(1, duracao) });
            }
          }

          if (!ehAcorde) {
            inicioNotaBase = cursor;
            cursor += duracao;
          }
        }
      });
    });

    if (notes.length) {
      tracks.push({ label: nomesPartes.get(id) || id || `Parte ${tracks.length + 1}`, notes, on: true, instr: "Piano · Para Novato" });
    }
  });

  if (!tracks.length) throw new Error("Não achei notas em nenhuma parte desse MusicXML.");

  return { div: divisions, tempo, tsn, tsd, tracks };
}
