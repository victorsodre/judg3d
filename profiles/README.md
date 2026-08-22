# Perfis

Um perfil e o contrato de qualidade do dono do pipeline, versionado no repo
dele. O "certo" de e-commerce nao e o de filme — por isso a tolerancia mora
aqui, nunca no codigo do juiz.

## web-commerce v0.1.0

So a camada L1 (SCHEMA) vem ligada aqui. A L2 existe desde 22/08/2026 mas fica
**desligada neste perfil de proposito**: orcamento e decisao de quem e dono do
pipeline, e inventar um teto de triangulos para "e-commerce em geral" seria
exatamente o numero hardcoded que o invariante 2 proibe. Ligue a L2 e escolha
os seus.

As chaves de L3-L5 ja existem no formato para que ligar uma delas no futuro nao
mude o schema do arquivo.

| Chave | Efeito |
|-------|--------|
| `layers.schema.failOn` | `error` reprova so nos erros do validator; `warn` reprova tambem nos avisos |
| `layers.schema.report` | Severidade minima que vira `Violation` no relatorio. `warn` mantem infos e hints fora |
| `layers.schema.ignoredIssues` | Codigos do glTF Validator a ignorar, ex.: `["UNUSED_OBJECT"]` |
| `layers.schema.severityOverrides` | Codigo -> severidade Khronos (`0` Error, `1` Warning, `2` Info, `3` Hint) |
| `layers.schema.maxIssues` | Teto de issues reportadas. `0` e ilimitado |

O schema e estrito: chave desconhecida derruba o comando com exit 2. Um typo
em `ignoredIssues` seria um asset ruim aprovado sem ninguem perceber.

Ligar uma camada ainda nao implementada (`geometry`, `visual`, `semantic`)
tambem da exit 2, pelo mesmo motivo.

## agent-loop v0.1.0

Perfil para **pipeline de autoria conduzido por agente**, onde o asset e criado
em rodadas sucessivas e o juiz e o portao de cada uma. L1 e L2 ligadas.

Os tetos vieram de um projeto real (`tumbler-three`) e sao dele, nao do judg3d:
350 000 triangulos, 60 draw calls, 20 materiais, textura ate 2048 px. Copie e
troque pelos seus — o valor do arquivo e ser versionado com diff e review, nao
ser universal.

| Chave | Efeito |
|-------|--------|
| `layers.profile.failOn` | Independente do `failOn` do schema. Tolerar aviso do validator num asset de terceiro nao deveria implicar tolerar estouro de orcamento |
| `layers.profile.budgets.maxTriangles` | Teto de triangulos. `null` desliga |
| `layers.profile.budgets.maxVertices` | Teto de vertices. `null` desliga |
| `layers.profile.budgets.maxMaterials` | Teto de materiais. `null` desliga |
| `layers.profile.budgets.maxDrawCalls` | Teto de draw calls. `null` desliga |
| `layers.profile.budgets.maxTextureSize` | Maior lado de qualquer imagem, em pixels. `null` desliga |
| `layers.profile.requireSelfContained` | Reprova recurso fora do container (`storage` diferente de `glb`, `buffer-view` ou `data-uri`) |

**`null` nao e `0`.** `null` e "sem teto"; `0` e "teto zero", que reprova
qualquer asset. A distincao e explicita porque um campo esquecido nao pode
reprovar tudo em silencio.

### Por que autocontencao e um teste que vale

Um GLB com URI externa e glTF **valido** — o validator nao o acusa, e nao
deveria. Ele funciona na maquina de quem exportou e quebra em qualquer outra.
E a classe de defeito silencioso que um juiz de aceitacao existe para pegar, e
a informacao ja vinha no relatorio sem custo nenhum.

Origem dos numeros e do racional: `docs/calibracao-tumbler.md`.
