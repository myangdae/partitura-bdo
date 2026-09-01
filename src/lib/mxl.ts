/**
 * Leitor mínimo de .mxl — o container zip que o MusicXML usa quando comprimido (o formato
 * padrão de download do MuseScore.com). Lê só o suficiente do formato zip pra achar e
 * descomprimir a partitura principal: acha o fim do diretório central, lê as entradas,
 * localiza a partitura via META-INF/container.xml (ou, na falta dele, o primeiro .xml que não
 * é metadado) e descomprime com a DecompressionStream do navegador. Não escreve zip — só lê.
 */

interface EntradaZip {
  nome: string;
  offset: number;
  compressao: number;
  tamanhoComprimido: number;
}

async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  writer.write(dados as BufferSource);
  writer.close();
  const buf = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(buf);
}

function listarEntradas(view: DataView, bytes: Uint8Array): EntradaZip[] {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("Arquivo .mxl corrompido ou não é um zip válido.");

  const totalEntradas = view.getUint16(eocd + 10, true);
  const entradas: EntradaZip[] = [];
  let p = view.getUint32(eocd + 16, true);

  for (let i = 0; i < totalEntradas; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error("Arquivo .mxl corrompido (diretório central inválido).");
    const compressao = view.getUint16(p + 10, true);
    const tamanhoComprimido = view.getUint32(p + 20, true);
    const nomeLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const comentarioLen = view.getUint16(p + 32, true);
    const headerOffset = view.getUint32(p + 42, true);
    const nome = new TextDecoder("utf-8").decode(bytes.subarray(p + 46, p + 46 + nomeLen));
    entradas.push({ nome, offset: headerOffset, compressao, tamanhoComprimido });
    p += 46 + nomeLen + extraLen + comentarioLen;
  }
  return entradas;
}

async function lerConteudo(view: DataView, bytes: Uint8Array, entrada: EntradaZip): Promise<Uint8Array> {
  const lp = entrada.offset;
  if (view.getUint32(lp, true) !== 0x04034b50) throw new Error("Arquivo .mxl corrompido (cabeçalho local inválido).");
  const nomeLen = view.getUint16(lp + 26, true);
  const extraLen = view.getUint16(lp + 28, true);
  const inicioDados = lp + 30 + nomeLen + extraLen;
  const comprimidos = bytes.subarray(inicioDados, inicioDados + entrada.tamanhoComprimido);
  if (entrada.compressao === 0) return comprimidos;
  if (entrada.compressao === 8) return inflar(comprimidos);
  throw new Error("Método de compressão do .mxl não suportado.");
}

/** Extrai o texto do MusicXML de dentro de um .mxl. */
export async function extrairXmlDeMxl(buffer: ArrayBuffer): Promise<string> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const entradas = listarEntradas(view, bytes);

  let alvo = entradas.find((e) => e.nome === "META-INF/container.xml");
  if (alvo) {
    const containerBytes = await lerConteudo(view, bytes, alvo);
    const containerTexto = new TextDecoder("utf-8").decode(containerBytes);
    const doc = new DOMParser().parseFromString(containerTexto, "application/xml");
    const caminho = doc.querySelector("rootfile")?.getAttribute("full-path");
    alvo = entradas.find((e) => e.nome === caminho);
  }
  if (!alvo) {
    alvo = entradas.find((e) => e.nome.toLowerCase().endsWith(".xml") && !e.nome.startsWith("META-INF/") && !e.nome.startsWith("__MACOSX"));
  }
  if (!alvo) throw new Error("Não achei a partitura dentro do .mxl.");

  const dados = await lerConteudo(view, bytes, alvo);
  return new TextDecoder("utf-8").decode(dados);
}
