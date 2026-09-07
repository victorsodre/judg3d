# AGENTS.md — judg3d

Juiz de aceitação determinístico para assets 3D. A fonte da verdade é
`docs/judg3d-spec-v0.md`; este arquivo é como trabalhar no repo.

## Comandos

```bash
pnpm install
pnpm build          # tsc --build (core -> judge -> cli)
pnpm typecheck      # tsc --build --force + o projeto dos testes
pnpm lint           # eslint type-aware
pnpm test           # build + vitest run
pnpm judg3d judge <asset> --profile profiles/web-commerce.json
pnpm fixtures:fetch # rebaixa os GLBs da Khronos e confere sha256
```

## Invariantes da spec — não negociáveis

1. **Determinismo.** `(assetHash, profileHash, engineVersion)` iguais produzem
   o mesmo verdict e os mesmos rasters. Nada de `Date.now()`, `Math.random()`
   ou ordem de `Set`/`Map` vazando pro relatório. `judge-report.json` sai sem
   timestamp por padrão justamente pra ser byte-determinístico.
2. **Tolerância mora no profile.** Nenhum número que decide aprovação pode
   estar hardcoded. Se você digitou um limite no código do juiz, ele está no
   lugar errado.
3. **Falha de infra ≠ reprovação.** Exit 0 aprovado, 1 reprovado, 2 infra. O
   único resultado inaceitável é um PASS que na verdade significa "essa
   checagem nem rodou". Camada habilitada e não implementada é exit 2, e
   arquivo que não é glTF é exit 1 (reprovou no SCHEMA), nunca 2.
4. **Toda violação é acionável.** Código estável + local (`nodePath`) +
   `got`/`want`. Uma violação sem lugar não ajuda agente nem pessoa.

## Camadas

| Camada | Estado | Onde |
|--------|--------|------|
| L1 SCHEMA | pronta | `packages/judge/src/layers/l1-schema.ts` |
| L2 PROFILE | pronta (orçamento + autocontenção) | `packages/judge/src/layers/l2-profile.ts` |
| L3 GEOMETRY | não implementada | — |
| L4 VISUAL | não implementada | — |
| L5 SEMANTIC | não implementada | — |

Implementar uma camada = criar `layers/lN-*.ts`, ligar em `judge.ts`, e
adicionar a `IMPLEMENTED_LAYERS` em `packages/core/src/profile.ts`. Enquanto
não estiver nessa lista, ligá-la no profile derruba o comando com exit 2 — e é
assim que tem que ser.

## Regras

- **Código completo.** Sem `TODO`, sem stub que retorna valor de mentira, sem
  função que finge medir. Campo que nenhuma camada computa fica ausente no
  relatório (`MeshMetrics.dimensions`), não recebe zero.
- **Portão antes de qualquer entrega:** `pnpm typecheck && pnpm lint &&
  pnpm test`, os três verdes. Sem exceção, nem pra "mudança pequena".
- **Dependências pinadas** em versão exata (`.npmrc` tem `save-exact=true`) e
  justificadas em uma linha no PR. Dependência nova só se ela remove trabalho
  de verdade — o runtime que vale a pena é o roubado (Khronos), não o npm.
- **Fixtures são imutáveis.** Nunca edite um arquivo em `fixtures/` no lugar.
  Caso novo é arquivo novo, com proveniência e sha256 em `fixtures/README.md`.
- **Apresentação compartilhada mora em `packages/core/src/present.ts`.**
  É o **único** módulo do core sem `node:`, publicado no subpath
  `@judg3d/core/present` para que o browser possa importar valor dele.
  Formatação de tamanho, hash curto e a linha `got`/`want` de uma violação
  saem de lá — CLI e app local importam, nunca copiam. Se a função precisa de
  `node:`, ela não pertence a esse arquivo. Tipos podem vir do root com
  `import type`, que é apagado na compilação.
- **Não reimplemente o que a Khronos já faz.** Validator, parser de formato,
  renderer: nada disso é código nosso. O valor está no profile-as-code e no
  relatório que o agente lê.
- **Nunca invente campo no contrato.** `Verdict`, `Violation`, `MeshMetrics` e
  `AnnotatedRender` são a transcrição da spec. Metadado novo vai no envelope
  `JudgeReport`, não dentro do `Verdict`. Campo novo no contrato exige **mudar
  a spec primeiro**, com a evidência que o justifica — foi assim que
  `MeshMetrics.textures` entrou (ver `docs/calibracao-tumbler.md`).
- Idioma: inglês como padrão do produto, documentação pública, código e outputs
  (CLI, API, MCP e JSON). A interface oferece pt-BR como opção persistida;
  mudar o idioma não altera o relatório nem o veredito.
- Commits convencionais, pequenos, um por etapa.

## Definição de pronto

- `pnpm typecheck`, `pnpm lint` e `pnpm test` verdes.
- `fixtures/valido.glb` e `fixtures/valido-textura.glb` passam com exit 0.
- `fixtures/quebrado.glb` reprova com exit 1 e violações legíveis.
- `judge-report.json` bate com o contrato e é idêntico entre duas execuções.
- Comportamento novo tem teste. Regra nova de aprovação tem chave no profile.
