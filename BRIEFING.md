# Partitura — briefing do projeto

Companheiro visual para o editor de música do Black Desert Online. Converte MIDI em um mapa de cliques que a pessoa copia à mão no jogo, sem precisar saber ler partitura.

**Status:** protótipo funcional em arquivo único (`partitura-bdo.html`). Pronto para virar projeto real.

---

## Problema

A função de composição do BDO está praticamente abandonada. O editor é um piano roll competente, mas exige que a pessoa já saiba música — ler partitura, entender compasso, traduzir tonalidade. A maioria dos jogadores não sabe, tenta uma vez e desiste.

O gargalo não é o editor do jogo. É a ponte entre "quero tocar essa música" e "sei onde clicar".

**Público:** jogadores de BDO, maioria sem formação musical, que querem tocar músicas conhecidas no jogo.

**Trabalho principal do produto:** transformar um arquivo de música em uma lista de tarefas visual. A pessoa nunca deve ver uma clave de sol.

---

## Restrições verificadas do editor do BDO

Levantadas por inspeção direta da interface. **Não alterar sem verificar no jogo de novo.**

| Campo | Valores reais |
|---|---|
| Ritmo | `3/4`, `4/4`, `6/8` — não existe 12/8 |
| Propriedade de Nota | `1/4`, `1/8`, `1/16`, `1/32`, `1/64` |
| Estilo | `Sustenido`, `Pedal de Sustentação` — só duas opções |
| Efeitos por faixa | Reverb, Delay, Chorus — botões de 0 a 100 |
| Effector global | Reverb: Time · Delay: Feedback · Chorus: Feedback, LFO Depth, LFO Frequency |
| Contador de notas | mostra `x/10000` no editor |
| Volume por faixa | slider 0–100 |
| Zoom do grid | controle de porcentagem com −/+ |

**Categorias de instrumento:** Flauta, Violinos, Piano Elétrico, Percussão. Dentro de cada uma, os instrumentos vêm agrupados por conjunto — `Para Novato`, `Florquestra`, `Marnis` — e os não desbloqueados aparecem em cinza. O catálogo completo está no objeto `INSTR` do protótipo.

**Layout do grid:** teclas sustenidas aparecem como abas escuras salientes à esquerda; naturais são só texto na régua. Altura de linha ~15px. Régua numerada no topo por compasso.

**Notação:** o jogo só usa sustenidos. Nada de bemol em lugar nenhum da interface.

### Ainda por confirmar no jogo

- Alcance real de cada instrumento (nota mais grave e mais aguda). Hoje está chutado como MIDI 36–96.
- Limite de notas e de compassos por grau de Talento Musical. O `10000` do editor não é o limite de salvamento.
- Como o campo de BPM conta o pulso. Empiricamente, `60` produziu 1,5s por grupo de três colcheias em 6/8 — o dobro do esperado. Confirmar a relação antes de automatizar a conversão de andamento.
- Quantos espaços de 1/8 cabem entre dois números da régua em cada Ritmo. Em 6/8 observamos 12, o que sugere que um segmento da régua equivale a dois compassos de 6/8.
- **Convenção de oitava.** A ferramenta assume MIDI 60 = C4 (dó central) e MIDI 69 = A4 = 440Hz — o padrão científico/MIDI. Os prints do editor mostram rótulos nesse mesmo formato (C4...D6), mas isso não prova que o motor de áudio do jogo usa o mesmo deslocamento de oitava ao tocar a nota — DAWs diferentes numeram isso de formas diferentes (ex.: Ableton chama o dó central de C3). Se estiver errado, toda conversão sai transposta por oitavas inteiras sem aviso nenhum. Verificação proposta: gravar uma nota isolada e conhecida tocada no jogo (ex. a tecla rotulada C4 ou A4, sem efeitos) e comparar a frequência com o que a ferramenta assume.

---

## Decisões tomadas

**Nunca ler nem escrever arquivos do jogo.** A ferramenta desenha o mapa, a pessoa copia. Existem conversores de terceiros que injetam partituras direto nos arquivos do BDO e carregam risco de banimento. Essa linha separa um utilitário legítimo de algo que ninguém deveria instalar — e é inegociável num produto que vai sair com nome de estúdio junto.

**MIDI e MusicXML como entrada principal, áudio como alternativa.** Os dois já trazem a informação exata que a transcrição de áudio tentaria adivinhar. MIDI é mais comum pra música popular; MusicXML aparece bastante em partituras clássicas do IMSLP e do MuseScore.com, às vezes sem MIDI equivalente disponível. `lib/musicxml.ts` lê o formato score-partwise direto com `DOMParser`, e `lib/mxl.ts` descompacta o `.mxl` (o zip que o MusicXML usa quando comprimido — é o padrão de download do MuseScore.com) sem depender de nenhuma lib de zip. Notas ligadas por `<tie>` são fundidas numa nota só pela altura; não diferencia por `<voice>`, então ligaduras cruzando vozes diferentes na mesma altura (raro) podem fundir errado.

**Áudio via Basic Pitch, rodando no cliente.** O `@spotify/basic-pitch` (TypeScript) roda no navegador com TensorFlow.js — o áudio nunca sai da máquina. A própria Spotify avisa que a precisão fica longe do nível humano e que o modelo funciona melhor com um instrumento por vez. Resultado de áudio precisa ser marcado visualmente como aproximação, sempre. Se a pessoa vai clicar 400 notas à mão, ela precisa saber antes que está copiando um chute.

**Nada de 12/8.** Peças em 12/8 (caso da Nocturne Op. 9 No. 2, que motivou o projeto) viram 6/8 com dois compassos do BDO para cada compasso original.

**A prévia sonora toca a versão quantizada, não o MIDI original.** É a única forma honesta de mostrar o que a grade vai estragar antes da pessoa investir horas.

---

## Stack proposta

Astro com uma ilha React para o editor. O site é majoritariamente estático e o app é uma tela só — Astro entrega HTML leve e isola o peso do TensorFlow.js num único componente carregado sob demanda.

- **Astro + React island** — editor isolado, resto estático
- **Tailwind** — dark-mode-first, bordas marcadas, mono nos dados do grid
- **Supabase** — necessário só na fase 3 (biblioteca compartilhada): auth, tabela de mapas publicados, storage dos MIDI
- **Vercel** — deploy
- **Framer Motion** — com parcimônia; o modo cópia é ferramenta de trabalho, não vitrine

Se a biblioteca compartilhada sair do escopo, Supabase e auth caem junto e o projeto vira estático puro.

---

## Estrutura sugerida

```
src/
  components/
    Roll.tsx           grid, renderização das notas, régua
    CopyMode.tsx       stepper compasso a compasso
    TrackPanel.tsx     faixas, instrumento, volume, efeitos
    Finder.tsx         busca de MIDI por nome
    Preview.tsx        prévia em Web Audio
  lib/
    midi.ts            parser de MIDI, sem dependências
    musicxml.ts        parser de MusicXML (score-partwise), via DOMParser do navegador
    mxl.ts             descompacta .mxl (zip) pra achar o MusicXML de dentro
    bdo.ts             constantes verificadas do editor
    quantize.ts        MIDI/MusicXML → colunas do grid
    analyze.ts         orçamento de notas, alcance, notas atípicas
    audio.ts           Basic Pitch, carregado sob demanda (Fase 3, ainda não construído)
  pages/
```

Os parsers de MIDI e MusicXML são próprios, sem dependência externa.

---

## Roadmap

**Fase 1 — migrar e confirmar.** Quebrar o HTML em componentes, mover o parser para `lib/`, preencher as constantes verificadas. Ir ao jogo e fechar os quatro itens da lista "ainda por confirmar". Sem esses números o aviso de orçamento é decorativo.

**Fase 2 — a inteligência que decide se a música existe ou não.**

*Detecção de compassos repetidos.* Marcar "este compasso é igual ao 3, copie e cole". Numa peça com acompanhamento constante isso corta o trabalho em três quartos. É o maior ganho de tempo do produto inteiro.

*Sugestão automática de corte.* Quando estoura o limite de notas, apontar o que sacrificar: acordes de 4 notas que viram 3, ornamentos que não cabem na grade, repetições dispensáveis. Hoje a ferramenta só avisa que não cabe, e a análise de o que cortar é a parte mais chata de fazer à mão.

**Fase 3 — entrada de áudio.** Basic Pitch sob demanda, com aviso de aproximação e recomendação de piano solo.

**Fase 4 — biblioteca compartilhada.** Alguém converte, ajusta, publica o mapa pronto. O próximo não refaz nada. É o que faria a função voltar a ter movimento no jogo: o gargalo real hoje não é a ferramenta, é que cada pessoa começa do zero sozinha.

**Ideia futura, ainda não planejada — afinador ao vivo.** Ouvir o áudio do jogo pelo microfone durante o modo cópia e comparar a nota captada com a nota esperada da coluna atual, avisando se divergem. Resolveria de raiz a questão da convenção de oitava (item em "Ainda por confirmar") e pegaria erros de instrumento errado ou transposição esquecida em tempo real, não só depois que a pessoa já clicou tudo. Depende de detecção de pitch no navegador (autocorrelação ou YIN) — sem dependência de servidor, mesmo espírito do Basic Pitch local da Fase 3.

---

## Notas de produto

O modo cópia é o coração. Tudo que aparece na tela durante uma sessão de cópia tem que servir a uma pergunta só: onde clico agora. Fora dele, a interface pode ser mais rica.

Escrever sempre do ponto de vista de quem não sabe música. "Coluna 3, três notas juntas" em vez de "acorde na segunda colcheia". Os nomes de nota aparecem porque estão escritos no jogo, não porque a pessoa precisa entendê-los.

Se um número for chute, dizer que é chute. A ferramenta perde a confiança do usuário no primeiro aviso de orçamento que estiver errado.
