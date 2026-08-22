---
tags: [projeto/judg3d, calibracao]
updated: 2026-08-22
---

# Calibração contra um pipeline real — 78 rodadas

O `judg3d` rodou como portão de aceitação dentro do `tumbler-three`, um projeto
de modelagem 3D conduzido por agente em loop fechado, entre 21 e 22/08/2026.
Setenta e oito rodadas, cada uma com um critic cego independente e registro
escrito.

Este documento é o que sobrou de útil. As notas brutas, com 35 hipóteses
numeradas, estão em `tumbler-three/gauntlet/judg3d-notas.md`.

## O número que abre o relatório

| | |
|---|---|
| Rodadas do projeto | **78** |
| Execuções do juiz registradas | **7** |
| `exit 0` | **7** |
| `exit 1` | **0** |
| `exit 2` | **0** |
| Reprovações do critic no período | **~30** |
| Defeitos que só o critic pegou | **todos, menos um** |

Zero `exit 2` em 78 rodadas é o dado positivo e vale registrar: a infra nunca
falhou, nunca produziu diagnóstico falso, e a distinção entre reprovação e
falha de infra nunca precisou ser explicada a ninguém.

O resto é o que este documento existe para consertar.

## As quatro hipóteses da calibração

**H1 — "a L1 não reprova quase nada num pipeline de autoria": confirmada.**
Zero `exit 1` em 78 rodadas. O exportador do three gerou glTF válido em todas
elas, inclusive com hierarquia de nós nomeados e 45 materiais. A L1 continua
essencial para asset de terceiro — mas para quem *cria* o asset, ela é um
portão que quase nunca fecha.

**H2 — "o primeiro defeito real será orçamento, não validade": confirmada, com
correção.** Não foi triângulo nem draw call: foi **material**. 35 contra teto de
20, **75% acima**, enquanto os triângulos estavam em **0,7%** do teto e os draw
calls em 58%.

E o detalhe que decidiu esta sessão: **aquele portão vivia fora do judg3d**,
num script do projeto. O único defeito que uma checagem automática pegou em 78
rodadas foi pego por uma regra que o juiz não tinha. Foi o que motivou
implementar a L2.

**H3 — "vai faltar métrica de material": confirmada, e mais forte do que foi
formulada.** A mudança que mais alterou a imagem em vinte rodadas —
`baseColorFactor` de 0,0075 para 0,05 — produziu **duas linhas idênticas** na
série de métricas. Contar materiais não diz nada sobre o conteúdo deles.

**H4 — "nó vazio e hierarquia órfã não serão pegos": não testada.** O modelo
nunca chegou a ter nó de pivô sem geometria. Continua em aberto.

## O que entrou nesta sessão

### L2 PROFILE — orçamento

Traz para dentro do juiz a única checagem automática que funcionou em 78
rodadas. Cinco limites, todos opcionais, todos no profile:

```
maxTriangles · maxVertices · maxMaterials · maxDrawCalls · maxTextureSize
```

`null` desliga o limite, e a diferença entre *sem teto* e *teto zero* é
explícita — um campo esquecido não pode reprovar tudo em silêncio.

### L2 PROFILE — autocontenção

`requireSelfContained` reprova recurso que mora fora do container. A informação
já estava no relatório do validator (`info.resources[].storage`) e custava uma
comparação de string.

Isto é uma **lacuna da L1, não uma novidade da L2**: um GLB com URI externa é
glTF perfeitamente válido, então o validator não o acusa — e ele funciona na
máquina de quem exportou e quebra em qualquer outra. É exatamente a classe de
defeito silencioso que a L1 existe para pegar.

Os valores de `storage` foram confirmados **empiricamente** contra o validator
2.0.0-dev.3.10, não lidos da documentação: `glb`, `buffer-view`, `data-uri`
mantêm o recurso dentro; qualquer outro aponta para fora.

### `MeshMetrics.textures` — a resposta parcial à H3

`{ count, maxSize }`, vindo de `info.resources[].image`. Ausente — e não zero —
quando o asset não tem imagem.

É o primeiro atributo de **conteúdo** de material que dá para medir sem abrir o
JSON do glTF. Não fecha a H3, mas move a série de métricas de "35 materiais" para
"35 materiais, 12 texturas, maior 4096" — e a segunda frase é acionável.

### `severityByCode` — a severidade sai do profile

A primeira versão desta camada emitia toda violação como `error`, e isso a
tornava inutilizável no próprio loop que a motivou: o `tumbler-three` trata
orçamento estourado como **gap a fechar antes da entrega**, não como motivo
para parar a rodada. Com severidade fixa, um modelo de 45 materiais reprovaria
todas as rodadas seguintes sem dizer nada que a primeira já não tivesse dito.

A escolha passou para o profile, com `error` como padrão — o silêncio tem que
ser pedido, nunca herdado. `METRICS_UNAVAILABLE` não pode ser rebaixado.

### `got`/`want` visível na saída humana

A primeira violação de orçamento imprimiu só `MATERIALS_OVER_BUDGET`, sem o
número. O invariante 4 da spec diz que toda violação é acionável — código,
local e `got`/`want` — e a saída do CLI só sabia renderizar `got.message`,
porque até então **toda** violação vinha da L1 e trazia mensagem.

> O buraco existia desde o começo e só apareceu quando uma violação sem
> `message` chegou. Um invariante que nunca foi exercido não está garantido.

## O que ficou de fora, e por quê

**Materiais duplicados.** O achado com o número mais forte da calibração: 35
materiais para 21 meshes distintas, das quais 24 eram quatro variantes repetidas
seis vezes. Uma métrica de `materiaisUnicos` teria devolvido **11 contra 35**.

Não entrou porque exige ler o array `materials` do JSON do glTF, e o `info` do
validator não o expõe. Ler o chunk JSON de um GLB é escrever um parser de
formato — proibido pelo `AGENTS.md`, e a proibição está certa.

**Decisão do Victor, não minha:** adotar uma dependência que já leia glTF
(`@gltf-transform/core` é a candidata óbvia, e a spec já prevê "Auditor +
extensões") destrava de uma vez:

- materiais duplicados e materiais sem uso — **H3**
- nó sem geometria e hierarquia órfã — **H4**, nunca testada
- refletância linear do `baseColorFactor` — o `#14161A` de 0,0075 que custou
  quatro rodadas de critic para ser isolado à mão
- texel density e UV, que a spec já lista como L2

Sem ela, a L2 fica no que o `info` entrega, que é o que está implementado.

## O primeiro asset de produção derrubou o juiz

Em 22/08/2026 o `judg3d` rodou pela primeira vez contra um GLB de verdade —
202 326 faces, 14 materiais, 20 texturas, 35 MB — em vez das caixas de 12
triângulos e das cenas geradas por código.

Ele quebrou:

```
judg3d: falha inesperada — RangeError: Maximum call stack size exceeded
Isto e uma falha de infraestrutura (exit 2), nao uma reprovacao do asset.
```

**A classificação estava certa** e vale registrar como acerto: exit 2, infra,
não reprovação. O invariante 3 funcionou exatamente como escrito, num caminho
que nunca tinha sido exercido.

### A causa

`violations.push(...result.violations)`.

O spread passa **cada elemento como argumento**, e o número de argumentos de uma
chamada tem teto — na prática entre 60 e 125 mil no V8. O validator devolveu
**632 379** violações para aquele asset.

> O tamanho da entrada do usuário nunca pode virar tamanho de lista de
> argumentos. Um laço não tem teto; uma chamada tem.

O bug estava lá desde a L1. Nenhum fixture tinha mais de quatro violações, então
nada o exercia — a mesma forma do H29 e do H33: **a ferramenta não é conferida
contra o caso que ela existe para tratar.**

### O segundo defeito, que só apareceu depois de consertar o primeiro

Das 632 379 violações, **632 332 eram o mesmo código**
(`ACCESSOR_JOINTS_USED_ZERO_WEIGHT`). Um relatório com seiscentas mil linhas
idênticas não é acionável nem para agente nem para pessoa — o invariante 4
falha por volume, não por conteúdo.

`maxIssues` não resolvia: ele corta o **total**, então um teto de 500 devolveria
500 cópias do código mais frequente e **nenhum** dos outros quatro.

Entrou `maxPerCode`, que preserva a **diversidade** — o que torna um laudo
acionável não é o número de linhas, é quantos problemas distintos ele nomeia.
O que for cortado sai declarado numa violação `ISSUES_TRUNCATED` com a contagem
por código, porque corte silencioso lê como *"está tudo aqui"*.

Resultado no mesmo asset: relatório de **32 KB com 65 violações**, cobrindo os
cinco códigos distintos, em vez de um arquivo de centenas de megabytes.

Default `0` (ilimitado): o comportamento anterior não muda para quem não pediu.

## O achado estrutural — e ele não é sobre 3D

Das 35 hipóteses, a maioria **não** pede um juiz mais inteligente:

> **Um juiz de aceitação melhora mais por ser obrigado a declarar como sabe do
> que por saber mais.**

Oito das primeiras quinze se resolvem com **campos obrigatórios num contrato de
saída**. Zero compute, zero modelo melhor.

E há um segundo padrão, mais forte: **sete pontos cegos, todos de quem conduzia
o loop, nenhum do juiz, todos resolvidos por contagem entre rodadas**. Em todos
os sete o dado já estava no repositório.

> **O juiz reportou. O sistema não tinha onde guardar o que foi reportado e não
> foi atacado.**

### Onde isso cabe no judg3d

Boa parte dessas hipóteses descreve um juiz **baseado em modelo** — o critic
cego —, não o judg3d determinístico. O lugar delas na spec é a **L5 SEMANTIC**,
e são a melhor lista de requisitos que essa camada vai ter.

Duas, porém, cabem no judg3d como ele é hoje, e nenhuma precisa de renderer:

**1 · Memória entre verdicts.** Um `--baseline <report.json>` que compare o
verdict atual com o anterior e devolva, por achado, há quantas execuções ele
persiste. Um item na oitava aparição não pode ser apresentado como se fosse
novo. É contagem, é determinístico, e mata quatro dos sete pontos cegos.

**2 · Resolução efetiva derivada, nunca declarada.** Quando a L4 existir:
`px/m = largura_do_frame / (2 · distância · tan(fov/2) · aspecto)`. Cada
critério declara seu mínimo, e um artefato abaixo dele devolve `naoResolvivel`
em vez de uma nota.

> Julgar acabamento onde 20 mm ocupam 2,5 px não é julgar mal. É julgar
> **nada**, com uma nota que parece uma nota. Nota baixa e `naoResolvivel`
> levam quem lê a lugares opostos: a primeira manda mexer no modelo, a segunda
> manda mexer na câmera.

## O defeito de produto mais sério

O juiz rodou **7 vezes em 78 rodadas** porque o projeto só o executava quando o
asset mudava — e num loop de agente a maioria das rodadas não muda o asset.

O efeito colateral é pior que a ausência: quem lê a série vê
`001 → 008 → 012 → 020 → 031 → 035 → 037` e **não consegue distinguir "não
rodou" de "rodou e o asset é o mesmo"**. Entre a rodada 037 e a 078 não há uma
linha sequer.

> Um juiz que só aparece quando é chamado não é portão; é consultoria.

O conserto é barato e metade dele já existe: `judge-report.json` **já carrega
`asset.sha256`**. Falta o consumidor gravá-lo na série, e falta ao CLI um modo
que responda `inalterado (mesmo sha)` em vez de simplesmente não ser executado.

## Ordem sugerida para a próxima sessão

1. **Dependência de leitura de glTF** — destrava H3, H4 e metade da L2 que a
   spec já promete. É a decisão de maior alcance e é do Victor
2. **`--baseline` com contagem de reincidência** — o achado estrutural mais
   forte do relatório, e não precisa de renderer
3. **L4 VISUAL com resolução derivada** — a sessão do rasterizador que já estava
   planejada, agora com `naoResolvivel` no contrato desde o primeiro dia
