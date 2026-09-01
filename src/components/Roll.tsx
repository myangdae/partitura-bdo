import { useEffect, useMemo, useRef } from "react";
import type { NotaGrid } from "../lib/quantize";
import { larguraColuna } from "../lib/quantize";
import { nomeNota, ehSustenido } from "../lib/bdo";

interface RollProps {
  notas: NotaGrid[];
  compassos: number;
  espacosPorCompasso: number;
  divisor: number;
  alcance: { lo: number; hi: number };
  guide: boolean;
  curBar: number;
  playheadRef: React.RefObject<HTMLDivElement | null>;
  indicesSuspeitos: Set<number>;
}

export default function Roll({ notas, compassos, espacosPorCompasso, divisor, alcance, guide, curBar, playheadRef, indicesSuspeitos }: RollProps) {
  const layout = useMemo(() => {
    if (!notas.length) return null;
    const midis = notas.map((n) => n.m);
    const min = Math.min(...midis) - 1;
    const max = Math.max(...midis) + 1;
    const cols = compassos * espacosPorCompasso;
    const colWidth = larguraColuna(cols);
    return { min, max, cols, colWidth };
  }, [notas, compassos, espacosPorCompasso]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const colWidthForScroll = layout?.colWidth ?? 0;
  useEffect(() => {
    if (guide && scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, curBar * espacosPorCompasso * colWidthForScroll - 60);
    }
  }, [guide, curBar, espacosPorCompasso, colWidthForScroll]);

  if (!notas.length || !layout) {
    return (
      <div className="bg-sunk">
        <div className="p-11 text-center text-ink3 text-sm">Abra um MIDI ou carregue o exemplo.</div>
      </div>
    );
  }

  const { min, max, cols, colWidth } = layout;
  const rows: number[] = [];
  for (let m = max; m >= min; m--) rows.push(m);

  return (
    <div ref={scrollRef} className="overflow-auto max-h-[540px] bg-sunk">
      <div className="relative flex w-max">
        <div className="sticky left-0 z-[4] bg-sunk border-r border-edge2 flex-none w-[66px]">
          {rows.map((m) => {
            const sharp = ehSustenido(m);
            return (
              <div key={m} className="h-[15px] relative">
                {sharp ? (
                  <span className="absolute left-0 top-[1px] h-[13px] w-[46px] bg-[#2a2e35] border border-[#3a3f48] rounded-[2px] text-[9.5px] leading-[11px] text-center text-[#b9bfc8]">
                    {nomeNota(m)}
                  </span>
                ) : (
                  <span className="absolute right-[5px] top-0 text-[9.5px] leading-[15px] text-ink3">{nomeNota(m)}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="relative flex-none" style={{ width: cols * colWidth }}>
          {rows.map((m) => {
            const sharp = ehSustenido(m);
            const outOfRange = m < alcance.lo || m > alcance.hi;
            return (
              <div
                key={m}
                className="h-[15px] border-b border-[#1a1d21]"
                style={{ background: outOfRange ? "#2a1a19" : sharp ? "#191c20" : undefined }}
              />
            );
          })}

          {Array.from({ length: cols + 1 }, (_, c) => {
            const isBar = c % espacosPorCompasso === 0;
            const isBeat = c % divisor === 0;
            return (
              <div
                key={`vl-${c}`}
                className="absolute top-0 bottom-0 w-px"
                style={{ left: c * colWidth, background: isBar ? "#454b56" : isBeat ? "#2d323a" : "#22262c" }}
              />
            );
          })}
          {Array.from({ length: compassos }, (_, i) => (
            <div key={`bn-${i}`} className="absolute top-[2px] text-[10px] text-ink3 pl-[5px] z-[3]" style={{ left: i * espacosPorCompasso * colWidth }}>
              {i + 1}
            </div>
          ))}

          {notas.map((n, i) => {
            const inBar = guide && Math.floor(n.c / espacosPorCompasso) === curBar;
            const outOfRange = n.m < alcance.lo || n.m > alcance.hi;
            const suspeita = indicesSuspeitos.has(i);
            return (
              <div
                key={i}
                title={suspeita ? "Nota atípica — candidata a ruído de transcrição" : undefined}
                className={
                  "absolute h-[13px] rounded-[2px] text-[9px] leading-[11px] pl-[3px] overflow-hidden whitespace-nowrap z-[2] " +
                  (outOfRange
                    ? "bg-rose border border-[#dd7a6d] text-[#2a1210]"
                    : inBar
                      ? "bg-gold border border-[#f0bb6d] text-[#2a1c07]"
                      : "bg-[#c8ccd3] border border-[#9aa0a8] text-[#22262c]") +
                  (suspeita ? " outline outline-2 outline-dashed outline-noise -outline-offset-1" : "")
                }
                style={{ left: n.c * colWidth, top: (max - n.m) * 15 + 1, width: Math.max(4, n.l * colWidth - 1) }}
              >
                {colWidth > 17 ? nomeNota(n.m) : ""}
              </div>
            );
          })}

          {guide && (
            <>
              {curBar > 0 && (
                <div className="absolute top-0 bottom-0 bg-[rgba(16,18,21,.72)] z-[3] pointer-events-none" style={{ left: 0, width: curBar * espacosPorCompasso * colWidth }} />
              )}
              {curBar < compassos - 1 && (
                <div
                  className="absolute top-0 bottom-0 right-0 bg-[rgba(16,18,21,.72)] z-[3] pointer-events-none"
                  style={{ left: (curBar + 1) * espacosPorCompasso * colWidth }}
                />
              )}
            </>
          )}

          <div ref={playheadRef} className="absolute top-0 bottom-0 w-[2px] bg-gold z-[5] hidden" />
        </div>
      </div>
    </div>
  );
}
