# Perfis

Um perfil e o contrato de qualidade do dono do pipeline, versionado no repo
dele. O "certo" de e-commerce nao e o de filme — por isso a tolerancia mora
aqui, nunca no codigo do juiz.

## web-commerce v0.1.0

So a camada L1 (SCHEMA) esta implementada nesta versao, entao so ela vem
ligada. As chaves de L2-L5 ja existem no formato para que ligar uma delas no
futuro nao mude o schema do arquivo.

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
