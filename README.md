# Partitura

Companheiro visual para o editor de música do Black Desert Online. Converte MIDI em um mapa de cliques que a pessoa copia à mão no jogo, sem precisar saber ler partitura.

A função de composição do BDO exige que quem usa já saiba ler partitura, entender compasso e traduzir tonalidade — a maioria dos jogadores não sabe, tenta uma vez e desiste. Esta ferramenta não lê nem escreve nada do jogo: ela só desenha o mapa de cliques para a pessoa copiar. Detalhes do problema, restrições verificadas do editor do jogo e as decisões de produto estão em [BRIEFING.md](BRIEFING.md).

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:4321`. Clique em "Carregar exemplo de acompanhamento" para testar sem precisar de um arquivo MIDI.

```bash
npm run build    # build de produção em dist/
npm run check    # type-check do projeto Astro + React
```

## Stack

- **Astro + React** — ilha React isolando o editor (`src/components/Editor.tsx`), resto estático
- **Tailwind v4** — dark-mode-first, seguindo a paleta do editor do jogo

## Estrutura

```
src/
  lib/
    midi.ts        parser de MIDI sem dependências
    bdo.ts          constantes verificadas do editor do jogo (ritmos, instrumentos, estilos)
    quantize.ts     conversão de ticks de MIDI para colunas do grid
    analyze.ts      orçamento de notas e alcance do instrumento
  components/
    Editor.tsx      orquestrador — estado, arquivo, ajustes
    Roll.tsx         grid de notas
    CopyMode.tsx     stepper compasso a compasso ("modo cópia")
    TrackPanel.tsx   faixas e seleção de instrumento
    Finder.tsx       busca de MIDI por nome
  pages/
    index.astro
legacy/
  partitura-bdo.html  protótipo original de arquivo único, mantido como referência
```

## Status

Fase 1 do roadmap (ver BRIEFING.md): migração do protótipo para componentes concluída. Ainda faltam confirmar no jogo o alcance real de cada instrumento, o limite de notas por grau de Talento Musical e a relação exata entre BPM do editor e o tempo real no jogo — até lá, esses números na interface são estimativas, sinalizadas como tal.

## O que a ferramenta nunca faz

Não lê nem escreve arquivos do jogo. Existem conversores de terceiros que injetam partituras direto nos arquivos do BDO e carregam risco de banimento — essa linha é inegociável aqui.
