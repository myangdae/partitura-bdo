import { useEffect, useMemo, useRef, useState } from "react";
import { parseMidi, midiDeExemplo, type ArquivoMidi } from "../lib/midi";
import { quantizar, colunasDoCompasso, larguraColuna, dobrarParaAlcance } from "../lib/quantize";
import { analisarOrcamento } from "../lib/analyze";
import { RITMOS, PERBAR_POR_RITMO, PROPRIEDADES_DE_NOTA, ESTILOS, ALCANCE_PADRAO_CHUTADO, nomeNota, type Ritmo, type Estilo } from "../lib/bdo";
import Roll from "./Roll";
import TrackPanel from "./TrackPanel";
import CopyMode from "./CopyMode";
import Finder from "./Finder";

export default function Editor() {
  const [src, setSrc] = useState<ArquivoMidi | null>(null);
  const [ritmo, setRitmo] = useState<Ritmo>("6/8");
  const [perbar, setPerbar] = useState(12);
  const [divisor, setDivisor] = useState(2);
  const [bpm, setBpm] = useState(60);
  const [estilo, setEstilo] = useState<Estilo>("Pedal de Sustentação");
  const [transpor, setTranspor] = useState(0);
  const [alcanceLo, setAlcanceLo] = useState(ALCANCE_PADRAO_CHUTADO.lo);
  const [alcanceHi, setAlcanceHi] = useState(ALCANCE_PADRAO_CHUTADO.hi);
  const [limiteDeNotas, setLimiteDeNotas] = useState(500);
  const [dobrarOitava, setDobrarOitava] = useState(false);

  const [guide, setGuide] = useState(false);
  const [curBar, setCurBar] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  const { notas, compassos } = useMemo(() => {
    if (!src) return { notas: [], compassos: 0 };
    const resultado = quantizar(src, { divisor, espacosPorCompasso: perbar, transpor });
    if (!dobrarOitava) return resultado;
    return { notas: dobrarParaAlcance(resultado.notas, { lo: alcanceLo, hi: alcanceHi }), compassos: resultado.compassos };
  }, [src, divisor, perbar, transpor, dobrarOitava, alcanceLo, alcanceHi]);

  useEffect(() => {
    if (curBar >= compassos) setCurBar(0);
  }, [compassos]);

  const analise = useMemo(
    () => analisarOrcamento(notas, compassos, { limiteDeNotas, alcanceInstrumento: { lo: alcanceLo, hi: alcanceHi } }),
    [notas, compassos, limiteDeNotas, alcanceLo, alcanceHi],
  );

  const colunasAtual = useMemo(() => colunasDoCompasso(notas, curBar, perbar), [notas, curBar, perbar]);

  const listaTexto = useMemo(() => {
    let texto = "";
    for (let b = 0; b < compassos; b++) {
      colunasDoCompasso(notas, b, perbar).forEach((x) => {
        texto += `compasso ${String(b + 1).padStart(3)} · coluna ${String(x.c + 1).padStart(2)}   ${x.ms.map(nomeNota).join("  ")}\n`;
      });
    }
    return texto;
  }, [notas, compassos, perbar]);

  function resetSessao() {
    setGuide(false);
    setCurBar(0);
    setDone({});
    stopPlay();
  }

  function carregarArquivo(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseMidi(reader.result as ArrayBuffer);
        setSrc(parsed);
        setPerbar(parsed.tsn * (8 / parsed.tsd) * 2 || 12);
        resetSessao();
        setErrorMsg(null);
        const bpmSugerido = Math.round(60000000 / parsed.tempo);
        setLoadWarning(
          `O arquivo indica ${bpmSugerido} BPM em ${parsed.tsn}/${parsed.tsd}. O BDO conta o pulso de outro jeito — ajuste o BPM pelo cronômetro do jogo, não copiando esse número.`,
        );
      } catch (e) {
        setSrc(null);
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setLoadWarning(null);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function carregarExemplo() {
    setSrc(midiDeExemplo());
    setPerbar(12);
    setDivisor(2);
    setRitmo("6/8");
    setBpm(60);
    resetSessao();
    setErrorMsg(null);
    setLoadWarning(null);
  }

  function mudarRitmo(r: Ritmo) {
    setRitmo(r);
    setPerbar(PERBAR_POR_RITMO[r]);
  }

  function alternarFaixa(i: number) {
    setSrc((prev) => (prev ? { ...prev, tracks: prev.tracks.map((t, idx) => (idx === i ? { ...t, on: !t.on } : t)) } : prev));
  }

  function mudarInstrumento(i: number, rotulo: string) {
    setSrc((prev) => (prev ? { ...prev, tracks: prev.tracks.map((t, idx) => (idx === i ? { ...t, instr: rotulo } : t)) } : prev));
  }

  function alternarConcluida(chave: string) {
    setDone((prev) => ({ ...prev, [chave]: !prev[chave] }));
  }

  function play() {
    if (timerRef.current) {
      stopPlay();
      return;
    }
    if (!notas.length) return;
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    ctxRef.current = ctx;
    const spb = (60 / bpm / divisor) * 2;
    const t0 = ctx.currentTime + 0.08;
    const sustentado = estilo.startsWith("Pedal");
    notas.forEach((n) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = 440 * 2 ** ((n.m - 69) / 12);
      const s = t0 + n.c * spb;
      const d = n.l * spb * (sustentado ? 2.6 : 1);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.13, s + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0006, s + Math.max(0.14, d));
      o.connect(g).connect(ctx.destination);
      o.start(s);
      o.stop(s + Math.max(0.2, d) + 0.05);
    });
    const span = Math.max(...notas.map((n) => n.c + n.l));
    setPlaying(true);
    const colWidth = larguraColuna(compassos * perbar);
    if (playheadRef.current) playheadRef.current.style.display = "block";
    const inicio = performance.now();
    timerRef.current = window.setInterval(() => {
      const decorrido = (performance.now() - inicio) / 1000 / spb;
      if (playheadRef.current) playheadRef.current.style.left = decorrido * colWidth + "px";
      if (decorrido > span + 1) stopPlay();
    }, 30);
  }

  function stopPlay() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPlaying(false);
    if (playheadRef.current) playheadRef.current.style.display = "none";
    if (ctxRef.current) {
      ctxRef.current.close();
      ctxRef.current = null;
    }
  }

  async function copiarLista() {
    if (!listaTexto) return;
    try {
      await navigator.clipboard.writeText(listaTexto);
    } catch {
      /* clipboard indisponível — usuário pode selecionar manualmente na textarea */
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div className="wrap">
      <header>
        <h1 className="brand">
          Partitura<em>.</em>
        </h1>
        <p>Abre uma música e ela vira um mapa de cliques para o editor do Black Desert. Você não precisa saber ler partitura — só copiar o desenho.</p>
      </header>

      <div className="grid2">
        <div>
          <div className="card">
            <h2>Música</h2>
            <div className="body">
              <div
                className={"drop" + (dragOver ? " over" : "")}
                tabIndex={0}
                role="button"
                aria-label="Escolher arquivo MIDI"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) carregarArquivo(f);
                }}
              >
                <b>Escolher arquivo MIDI</b>
                <span>ou arrasta um .mid aqui</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mid,.midi"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) carregarArquivo(f);
                }}
              />
              <div className="orline">ou</div>
              <button className="btn" style={{ width: "100%" }} onClick={carregarExemplo}>
                Carregar exemplo de acompanhamento
              </button>
            </div>
          </div>

          <div className="card">
            <h2>Não tem o arquivo?</h2>
            <div className="body">
              <Finder />
            </div>
          </div>

          <div className="card">
            <h2>Ajustes do editor</h2>
            <div className="body">
              <div className="f">
                <label htmlFor="ritmo">Ritmo</label>
                <select id="ritmo" value={ritmo} onChange={(e) => mudarRitmo(e.target.value as Ritmo)}>
                  {RITMOS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="f">
                <label htmlFor="div">Propriedade de nota</label>
                <select id="div" value={divisor} onChange={(e) => setDivisor(Number(e.target.value))}>
                  {PROPRIEDADES_DE_NOTA.map((p) => (
                    <option key={p.label} value={p.divisor}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <div className="hint">Quanto menor, mais fiel — e mais cliques.</div>
              </div>
              <div className="f">
                <label htmlFor="perbar">Espaços por compasso</label>
                <input id="perbar" type="number" min={1} max={64} value={perbar} onChange={(e) => setPerbar(Number(e.target.value))} />
                <div className="hint">Conta quantos espaços cabem entre dois números na régua do jogo.</div>
              </div>
              <div className="f">
                <label htmlFor="bpm">BPM</label>
                <input id="bpm" type="number" min={20} max={300} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
                <div className="hint">Só afeta a velocidade da prévia sonora (botão "Ouvir"). Não muda quais notas aparecem no grid.</div>
              </div>
              <div className="f">
                <label htmlFor="estilo">Estilo</label>
                <select id="estilo" value={estilo} onChange={(e) => setEstilo(e.target.value as Estilo)}>
                  {ESTILOS.map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Limites</h2>
            <div className="body">
              <div className="f">
                <label htmlFor="tr">Transpor (semitons)</label>
                <input id="tr" type="number" min={-36} max={36} value={transpor} onChange={(e) => setTranspor(Number(e.target.value))} />
                <div className="hint">Use para trazer notas de volta ao alcance.</div>
              </div>
              <div className="f">
                <label>Alcance do instrumento</label>
                <div className="duo">
                  <input type="number" aria-label="mais grave" value={alcanceLo} onChange={(e) => setAlcanceLo(Number(e.target.value))} />
                  <input type="number" aria-label="mais aguda" value={alcanceHi} onChange={(e) => setAlcanceHi(Number(e.target.value))} />
                </div>
                <div className="hint">Em número MIDI. 60 é o C4. Chutado — confirme no jogo o alcance real do seu instrumento.</div>
              </div>
              <div className="f">
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={dobrarOitava} onChange={(e) => setDobrarOitava(e.target.checked)} style={{ accentColor: "var(--color-gold)" }} />
                  Dobrar oitava das notas fora do alcance
                </label>
                <div className="hint">
                  Move só as notas que estouram o alcance uma ou mais oitavas pra dentro dele, mantendo a mesma nota da escala — diferente de
                  Transpor, não muda a tonalidade da música inteira. Ligue isso depois de conferir as notas atípicas (destacadas em roxo no
                  grid): dobrar a oitava de uma nota que já é ruído de transcrição só esconde o problema, não resolve.
                </div>
              </div>
              <div className="f">
                <label htmlFor="budget">Limite de notas do seu grau</label>
                <input id="budget" type="number" min={1} value={limiteDeNotas} onChange={(e) => setLimiteDeNotas(Number(e.target.value))} />
              </div>
            </div>
          </div>

          {src && (
            <div className="card">
              <h2>Faixas</h2>
              <div className="body">
                <TrackPanel tracks={src.tracks} onToggle={alternarFaixa} onInstrumentChange={mudarInstrumento} />
              </div>
            </div>
          )}
        </div>

        <div>
          {!!notas.length && (
            <div className="stats">
              <div className={"st " + (analise.passouDoLimite > 0 ? "bad" : "good")}>
                <b>{analise.totalNotas}</b>
                <span>notas · cabe {limiteDeNotas}</span>
              </div>
              <div className="st">
                <b>{analise.compassos}</b>
                <span>compassos</span>
              </div>
              <div className="st">
                <b>{analise.alcanceUsado ? `${nomeNota(analise.alcanceUsado.min)}–${nomeNota(analise.alcanceUsado.max)}` : "—"}</b>
                <span>alcance usado</span>
              </div>
              <div className={"st " + (analise.foraDoAlcance > 0 ? "bad" : "good")}>
                <b>{analise.foraDoAlcance}</b>
                <span>fora do alcance</span>
              </div>
            </div>
          )}

          <div>
            {errorMsg && <div className="msg bad">{errorMsg}</div>}
            {!!notas.length &&
              analise.avisos.map((a, i) => (
                <div key={i} className={"msg " + a.nivel}>
                  {a.texto}
                </div>
              ))}
            {loadWarning && <div className="msg warn">{loadWarning}</div>}
          </div>

          <div className="stage">
            <div className="bar">
              <h2>Grid</h2>
              <div className="legend">
                <span>
                  <i style={{ background: "#e0a04a" }}></i>compasso atual
                </span>
                <span>
                  <i style={{ background: "#c9584a" }}></i>fora do alcance
                </span>
                {analise.indicesSuspeitos.size > 0 && (
                  <span>
                    <i style={{ background: "#a479d9" }}></i>atípica (revisar)
                  </span>
                )}
              </div>
              <button className="btn" disabled={!notas.length} onClick={play}>
                {playing ? "Parar" : "Ouvir"}
              </button>
              <button
                className="btn-gold"
                disabled={!notas.length}
                onClick={() => {
                  setGuide((g) => !g);
                }}
              >
                {guide ? "Sair do modo cópia" : "Modo cópia"}
              </button>
            </div>
            <Roll
              notas={notas}
              compassos={compassos}
              espacosPorCompasso={perbar}
              divisor={divisor}
              alcance={{ lo: alcanceLo, hi: alcanceHi }}
              guide={guide}
              curBar={curBar}
              playheadRef={playheadRef}
              indicesSuspeitos={analise.indicesSuspeitos}
            />
          </div>

          {guide && !!notas.length && (
            <CopyMode
              colunas={colunasAtual}
              curBar={curBar}
              compassos={compassos}
              done={done}
              onToggleDone={alternarConcluida}
              onPrev={() => setCurBar((b) => Math.max(0, b - 1))}
              onNext={() => setCurBar((b) => Math.min(compassos - 1, b + 1))}
            />
          )}

          <textarea readOnly value={listaTexto} placeholder="A lista completa de cliques aparece aqui." />
          <div style={{ marginTop: 8 }}>
            <button className="btn" onClick={copiarLista}>
              Copiar lista
            </button>{" "}
            <span style={{ color: "var(--color-sage)", fontSize: 13 }}>{copiado ? "Copiado" : ""}</span>
          </div>
        </div>
      </div>

      <footer>
        A ferramenta não lê nem escreve nada do jogo — ela só desenha o mapa para você copiar à mão. Confirme dentro do jogo o alcance do seu
        instrumento e o limite de notas do seu grau, porque esses números mudam conforme o talento musical.
      </footer>
    </div>
  );
}
