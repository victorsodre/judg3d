# judg3d

Juiz de aceitação determinístico para assets 3D.

`Verdict = judge(asset, profile)` — o mesmo arquivo com o mesmo perfil sempre
dá o mesmo veredito. Um agente que gera 3D precisa de um gate que diga
**o que** está errado e **onde**, não de uma nota de 0 a 10.

**Status: pre-alpha.** Só a camada L1 (SCHEMA) está implementada. Nada
publicado no npm ainda.

## Por quê

Geração 3D por IA produz volume; volume sem gate produz slop. O "certo" de
e-commerce não é o de filme, então o gate não pode vir com opinião de fábrica:
ele vem de um `profile.json` versionado no repo de quem é dono do pipeline,
com diff e review como qualquer outro código.

O que o juiz não faz: renderer, parser de formato, retopologia, repair. Quem
valida glTF é o [glTF Validator oficial da Khronos](https://github.com/KhronosGroup/glTF-Validator).
O valor está no profile-as-code e no relatório que o agente consegue ler.

## Uso

```bash
pnpm install
pnpm build

pnpm judg3d judge fixtures/valido.glb   --profile profiles/web-commerce.json  # exit 0
pnpm judg3d judge fixtures/quebrado.glb --profile profiles/web-commerce.json  # exit 1
```

```
judg3d 0.0.0 · perfil web-commerce@0.1.0 · gltf-validator 2.0.0-dev.3.10
asset  fixtures/quebrado.glb  1,6 KB  sha256 641449b12c1f

REPROVADO — 3 erros, 0 avisos

  ERRO   SCHEMA  UNDEFINED_PROPERTY    /bufferViews/0
         Property 'buffer' must be defined.
  ERRO   SCHEMA  TYPE_MISMATCH         /meshes/0/primitives/0/mode
         Type mismatch. Property value 'TRIANGLES' is not a 'integer'.
  ERRO   SCHEMA  UNRESOLVED_REFERENCE  /meshes/0/primitives/0/attributes/POSITION
         Unresolved reference: 99.

métricas: 0 tris · 24 verts · 1 material · 1 draw call
camadas: SCHEMA
relatório: judge-report.json
```

O mesmo conteúdo sai em `judge-report.json`, que é o que o agente lê. Sem
timestamp por padrão: dois runs iguais produzem arquivos byte a byte idênticos.

### Exit codes

| Código | Significado |
|--------|-------------|
| `0` | asset aprovado |
| `1` | asset reprovado |
| `2` | falha de infraestrutura — nenhum veredito foi produzido |

Falha de infra nunca vira reprovação, e reprovação nunca vira falha de infra.
Um PASS que na verdade significa "essa checagem nem rodou" é o único resultado
que não pode existir.

## Camadas

| Camada | O que checa | Estado |
|--------|-------------|--------|
| L1 SCHEMA | glTF 2.0 válido, via Validator da Khronos | pronta |
| L2 PROFILE | texel density, UV, ranges PBR, budgets, dimensões | planejada |
| L3 GEOMETRY | manifold, normais invertidas, escala, pivô, textura ausente | planejada |
| L4 VISUAL | N views determinísticas vs baseline (SSIM, pixel ratio) | planejada |
| L5 SEMANTIC | VLM com rubrica estreita — nunca sozinho como gate | planejada |

Ligar no profile uma camada ainda não implementada derruba o comando com
exit 2, de propósito.

## App local

```bash
pnpm app:dev
# UI http://127.0.0.1:5173 · API http://127.0.0.1:8787
```

Interface no browser: solte um GLB, escolha o profile, veja o veredito.
A API reutiliza `@judg3d/judge` — mesmo contrato do CLI.

A API aceita apenas acesso local e as origens da UI local. O upload completo tem limite de 64 MiB, com até dois pedidos em andamento. Cada análise roda em um worker separado, encerrado após 30 segundos; atingir o limite retorna erro de infraestrutura, nunca um resultado PASS. O servidor limita o recebimento da requisição a 30 segundos e dos headers a 10 segundos. A listagem de profiles informa apenas o nome do arquivo.

## Pacotes

| Pacote | O que é |
|--------|---------|
| `@judg3d/core` | contrato `Verdict`/`Violation`, profile-as-code, envelope do relatório |
| `@judg3d/judge` | motor de camadas |
| `judg3d` | CLI |
| `@judg3d/mcp` | placeholder do MCP server |

## Desenvolvimento

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Node >= 22 (desenvolvido no 26), pnpm >= 11. Convenções e invariantes em
[`AGENTS.md`](./AGENTS.md); as decisões de produto em
[`docs/judg3d-spec-v0.md`](./docs/judg3d-spec-v0.md).

## Licença

A definir. Por ora o repo não tem `LICENSE`.

Os fixtures em `fixtures/` vêm do
[glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) da
Khronos sob CC BY 4.0; atribuição em [`fixtures/README.md`](./fixtures/README.md).
