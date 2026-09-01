import type { ColunaDoCompasso } from "../lib/quantize";
import { nomeNota } from "../lib/bdo";

interface CopyModeProps {
  colunas: ColunaDoCompasso[];
  curBar: number;
  compassos: number;
  done: Record<string, boolean>;
  onToggleDone: (chave: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function CopyMode({ colunas, curBar, compassos, done, onToggleDone, onPrev, onNext }: CopyModeProps) {
  const total = colunas.length || 1;
  const feitas = colunas.filter((x) => done[`${curBar}:${x.c}`]).length;
  const progresso = (feitas / total) * 100;

  return (
    <div className="mt-4 bg-panel border border-edge rounded-lg">
      <div className="flex items-center gap-3 p-3.5 border-b border-edge flex-wrap">
        <span className="font-serif text-[23px] tracking-tight">
          Compasso {curBar + 1} de {compassos}
        </span>
        <div className="flex-1 min-w-[120px] h-1 bg-sunk rounded-full overflow-hidden">
          <div className="h-full bg-gold transition-[width] duration-200" style={{ width: `${progresso}%` }} />
        </div>
        <button className="btn" onClick={onPrev} disabled={curBar === 0}>
          Anterior
        </button>
        <button className="btn-gold" onClick={onNext} disabled={curBar >= compassos - 1}>
          Próximo
        </button>
      </div>

      <div className="py-2 px-2.5 pb-3.5 flex flex-col gap-px">
        {colunas.length ? (
          colunas.map((x) => {
            const chave = `${curBar}:${x.c}`;
            const feita = !!done[chave];
            return (
              <div
                key={x.c}
                onClick={() => onToggleDone(chave)}
                className={"flex items-center gap-3 py-2.5 px-3 rounded-md cursor-pointer hover:bg-panel2 transition-colors" + (feita ? " opacity-40" : "")}
              >
                <span
                  className={
                    "flex-none w-[26px] h-[26px] rounded-md grid place-items-center text-xs " +
                    (feita ? "bg-gold-soft border border-gold2 text-gold" : "bg-sunk border border-edge text-ink3")
                  }
                >
                  {feita ? "✓" : x.c + 1}
                </span>
                <span className={"font-serif text-xl tracking-wide" + (feita ? " line-through" : "")}>{x.ms.map(nomeNota).join("   ")}</span>
                <span className="ml-auto flex-none text-[11.5px] text-ink3">{x.ms.length > 1 ? `${x.ms.length} juntas` : "sozinha"}</span>
              </div>
            );
          })
        ) : (
          <div className="py-11 px-5 text-center text-ink3 text-sm">Compasso vazio.</div>
        )}
      </div>
    </div>
  );
}
