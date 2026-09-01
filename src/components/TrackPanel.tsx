import type { FaixaMidi } from "../lib/midi";
import { INSTRUMENTOS, rotuloInstrumento } from "../lib/bdo";

interface TrackPanelProps {
  tracks: FaixaMidi[];
  onToggle: (index: number) => void;
  onInstrumentChange: (index: number, rotulo: string) => void;
}

export default function TrackPanel({ tracks, onToggle, onInstrumentChange }: TrackPanelProps) {
  return (
    <div>
      {tracks.map((track, i) => (
        <div key={i} className={"border border-edge rounded-md p-2.5 mb-2 bg-panel2" + (track.on ? "" : " opacity-45")}>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={track.on} onChange={() => onToggle(i)} className="accent-gold m-0 flex-none" aria-label="ativar faixa" />
            <span className="text-[13.5px] font-medium overflow-hidden text-ellipsis whitespace-nowrap">{track.label.replace(/[<>&]/g, "")}</span>
            <span className="ml-auto text-[11.5px] text-ink3 flex-none">{track.notes.length}</span>
          </div>

          <select
            value={track.instr}
            onChange={(e) => onInstrumentChange(i, e.target.value)}
            className="w-full bg-sunk border border-edge rounded-md mt-2 py-1.5 px-2 text-[12.5px]"
          >
            {Object.entries(INSTRUMENTOS).map(([categoria, instrumentos]) => (
              <optgroup key={categoria} label={categoria}>
                {instrumentos.map((inst) => (
                  <option key={rotuloInstrumento(inst)} value={rotuloInstrumento(inst)}>
                    {rotuloInstrumento(inst)}
                    {inst.bloqueadoPorPadrao ? " (bloqueado)" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <EffectKnobs indexInList={i} />
        </div>
      ))}
    </div>
  );
}

function EffectKnobs({ indexInList }: { indexInList: number }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 mt-2">
      {(["Reverb", "Delay", "Chorus"] as const).map((label) => (
        <div key={label}>
          <label className="block text-[10.5px] text-ink3 mb-0.5">{label}</label>
          <input
            type="number"
            min={0}
            max={100}
            defaultValue={label === "Reverb" ? (indexInList ? 30 : 45) : 0}
            className="w-full bg-sunk border border-edge rounded-md py-1 px-1.5 text-xs text-center"
          />
        </div>
      ))}
    </div>
  );
}
