import { useState } from "react";

type Fonte = { grupo: string } | { nome: string; descricao: string; url: (q: string) => string };

const FONTES: Fonte[] = [
  { grupo: "Procurar um MIDI pronto" },
  { nome: "BitMidi", descricao: "113 mil arquivos, ouve antes de baixar", url: (q) => "https://bitmidi.com/search?q=" + q },
  { nome: "FreeMidi", descricao: "pop, rock, temas de TV e filme", url: (q) => "https://www.google.com/search?q=site%3Afreemidi.org+" + q },
  { nome: "VGMusic", descricao: "música de videogame, 25 anos de acervo", url: (q) => "https://www.google.com/search?q=site%3Avgmusic.com+" + q },
  { nome: "MuseScore", descricao: "clássico e domínio público", url: (q) => "https://musescore.com/sheetmusic?text=" + q },
  { nome: "Busca aberta", descricao: "quando nenhum dos outros tem", url: (q) => "https://www.google.com/search?q=" + q + "+midi+download" },
  { grupo: "Só tem o áudio" },
  { nome: "Basic Pitch", descricao: "converte MP3 em MIDI no navegador", url: () => "https://basicpitch.spotify.com/" },
];

export default function Finder() {
  const [raw, setRaw] = useState("");
  const q = encodeURIComponent(raw.trim());

  return (
    <div>
      <div className="f">
        <label htmlFor="q">Escreva o nome da música</label>
        <input id="q" type="text" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="nocturne op 9 no 2" autoComplete="off" />
      </div>

      <div className="mt-3 flex flex-col gap-px">
        {FONTES.map((f, i) =>
          "grupo" in f ? (
            <div key={i} className="text-[11px] text-ink3 mt-2.5 mb-1 first:mt-0">
              {f.grupo}
            </div>
          ) : (
            <a
              key={i}
              href={f.url(q)}
              target="_blank"
              rel="noopener"
              className={
                "flex items-baseline gap-2 py-2 px-2.5 rounded-md text-ink no-underline text-[13.5px] transition-colors hover:bg-panel2" +
                (!raw.trim() && f.nome !== "Basic Pitch" ? " pointer-events-none opacity-35" : "")
              }
            >
              {f.nome}
              <span className="ml-auto text-[11.5px] text-ink3 text-right">{f.descricao}</span>
            </a>
          ),
        )}
      </div>
    </div>
  );
}
