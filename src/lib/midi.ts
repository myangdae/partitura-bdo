/**
 * Parser de MIDI sem dependências. Lê só o que a ferramenta precisa:
 * notas por faixa, tempo, fórmula de compasso e nome da faixa.
 * A ferramenta nunca escreve MIDI de volta — só lê.
 */

export interface NotaMidi {
  /** número MIDI da tecla (60 = C4) */
  m: number;
  /** início, em ticks */
  t: number;
  /** duração, em ticks */
  d: number;
}

export interface FaixaMidi {
  label: string;
  notes: NotaMidi[];
  on: boolean;
  instr: string;
}

export interface ArquivoMidi {
  /** ticks por semínima */
  div: number;
  /** microssegundos por semínima */
  tempo: number;
  tsn: number;
  tsd: number;
  tracks: FaixaMidi[];
}

function lerVlq(view: DataView, pos: { i: number }): number {
  let valor = 0;
  let byte: number;
  do {
    byte = view.getUint8(pos.i++);
    valor = (valor << 7) | (byte & 127);
  } while (byte & 128);
  return valor;
}

export function parseMidi(buffer: ArrayBuffer): ArquivoMidi {
  const view = new DataView(buffer);
  if (view.getUint32(0) !== 0x4d546864) {
    throw new Error("Esse arquivo não é um MIDI. Procure um .mid da música.");
  }
  const div = view.getUint16(12);
  if (div & 0x8000) {
    throw new Error("MIDI em formato SMPTE não é suportado.");
  }

  let pos = 14;
  const numTracks = view.getUint16(10);
  const tracks: FaixaMidi[] = [];
  let tempo = 500000;
  let tsn = 4;
  let tsd = 4;

  for (let t = 0; t < numTracks && pos + 8 <= buffer.byteLength; t++) {
    if (view.getUint32(pos) !== 0x4d54726b) {
      pos += 8 + view.getUint32(pos + 4);
      continue;
    }
    const end = pos + 8 + view.getUint32(pos + 4);
    const cursor = { i: pos + 8 };
    let tick = 0;
    let status = 0;
    const noteOn = new Map<number, number[]>();
    const notes: NotaMidi[] = [];
    let label = "";

    while (cursor.i < end) {
      tick += lerVlq(view, cursor);
      let byte = view.getUint8(cursor.i);
      if (byte & 0x80) {
        status = byte;
        cursor.i++;
      } else if (!status) {
        break;
      }

      if (status === 0xff) {
        const metaType = view.getUint8(cursor.i++);
        const len = lerVlq(view, cursor);
        if (metaType === 0x51 && len === 3) {
          tempo = (view.getUint8(cursor.i) << 16) | (view.getUint8(cursor.i + 1) << 8) | view.getUint8(cursor.i + 2);
        }
        if (metaType === 0x58 && len >= 2) {
          tsn = view.getUint8(cursor.i);
          tsd = 2 ** view.getUint8(cursor.i + 1);
        }
        if ((metaType === 3 || metaType === 4) && !label) {
          let s = "";
          for (let k = 0; k < len; k++) s += String.fromCharCode(view.getUint8(cursor.i + k));
          label = s.trim();
        }
        cursor.i += len;
      } else if (status === 0xf0 || status === 0xf7) {
        cursor.i += lerVlq(view, cursor);
      } else {
        const type = status & 0xf0;
        const a = view.getUint8(cursor.i++);
        const v = type === 0xc0 || type === 0xd0 ? 0 : view.getUint8(cursor.i++);
        if (type === 0x90 && v > 0) {
          if (!noteOn.has(a)) noteOn.set(a, []);
          noteOn.get(a)!.push(tick);
        } else if (type === 0x80 || (type === 0x90 && !v)) {
          const queue = noteOn.get(a);
          if (queue && queue.length) {
            const start = queue.shift()!;
            notes.push({ m: a, t: start, d: Math.max(1, tick - start) });
          }
        }
      }
    }

    pos = end;
    if (notes.length) {
      tracks.push({
        label: label || `Faixa ${tracks.length + 1}`,
        notes,
        on: true,
        instr: "Piano · Para Novato",
      });
    }
  }

  if (!tracks.length) {
    throw new Error("Não achei notas nesse arquivo.");
  }

  return { div, tempo, tsn, tsd, tracks };
}

/** Acompanhamento de exemplo, sem depender de arquivo externo. */
export function midiDeExemplo(): ArquivoMidi {
  const notes: NotaMidi[] = [];
  const baixo = 39;
  const acorde = [46, 51, 55];
  for (let grupo = 0; grupo < 4; grupo++) {
    const offset = grupo * 3;
    notes.push({ m: baixo, t: offset, d: 1 });
    [1, 2].forEach((k) => acorde.forEach((m) => notes.push({ m, t: offset + k, d: 1 })));
  }
  return {
    div: 1,
    tempo: 1000000,
    tsn: 6,
    tsd: 8,
    tracks: [{ label: "Acompanhamento", notes, on: true, instr: "Piano · Para Novato" }],
  };
}
