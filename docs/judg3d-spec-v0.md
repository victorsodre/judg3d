---
tags: [projeto/judg3d, spec]
updated: 2026-08-20
---

# judg3d — spec v0

## Unidade e primitiva

`Verdict = judge(asset | scene, profile, baseline?)` — função pura e determinística. O análogo do frame é a **view**: renders de câmeras fixas numeradas, endereçáveis, comparáveis contra baseline.

## Entradas na v0

1. Arquivo glTF/GLB — cobre output de geração (Tripo/Meshy/Hunyuan exportam GLB) e export de qualquer DCC.
2. Cena three.js/R3F viva — script injetado roda `GLTFExporter` em runtime → GLB canônico → mesmo pipeline. É o truque que transforma qualquer app three.js em asset julgável sem plugin.

USD, UE, Unity: fora da v0 (entram via export no futuro, não via engine).

## Runtime roubado (o que NÃO escrever)

- Khronos glTF Validator + Asset Auditor (Audit Profiles de 3D Commerce como perfis de fábrica).
- three.js headless com rasterizador de software pinado (SwiftShader/llvmpipe); Blender headless opcional para render de conferência de material.
- Não escrever: renderer, parser de formato, retopologia, repair.

## Profile-as-code

`profile.json` versionado no repo do cliente: herda um Audit Profile Khronos e estende — budgets de polycount/draw calls/texturas, escala esperada com tolerância, pivô/origem, naming, compressão exigida (Draco/KTX2), teto de arquivo. O "certo" de e-commerce não é o de filme; quem define é o dono do pipeline, em código, com diff e review. Todo o valor defensável mora aqui + no relatório que o agente lê.

## O juiz em camadas

- L1 SCHEMA — Validator: glTF válido.
- L2 PROFILE — Auditor + extensões: texel density, UV, PBR ranges, budgets, dimensões.
  **Implementada em parte:** budgets (triângulos, vértices, materiais, draw calls, maior textura) e autocontenção (nenhum recurso fora do container). Texel density, UV e PBR ranges precisam do JSON do glTF, que o `info` do validator não expõe — ver `docs/calibracao-tumbler.md`.
- L3 GEOMETRY — asserts próprios: manifold/watertight quando o perfil exigir, normais invertidas, triângulos degenerados, escala real vs declarada, pivô, hierarquia vazia, textura ausente.
- L4 VISUAL — N views determinísticas (rig de luz neutro vendorizado, câmeras fixas) vs baseline: SSIM + pixel ratio por view, máscara e threshold do perfil.
- L5 SEMANTIC (opcional, nunca gate sozinho) — VLM com rubrica estreita, peso baixo, sempre acompanhado do porquê determinístico.

## Contrato (TypeScript)

```ts
export type Verdict = {
  pass: boolean;
  violations: Violation[];
  views: AnnotatedRender[];   // stills com bbox — é isto que o agente lê
  metrics: MeshMetrics;       // tris, materiais, draw calls, texturas, dims, vram estimada
};

// MeshMetrics.textures?: { count, maxSize }  — acrescentado em 22/08/2026.
// Motivo, com evidencia: numa calibracao de 78 rodadas contra um pipeline de
// autoria por agente, a mudanca que mais alterou a imagem produziu duas linhas
// IDENTICAS na serie de metricas. Contar materiais nao diz nada sobre o
// conteudo deles, e resolucao e o primeiro atributo de conteudo mensuravel sem
// abrir o JSON do glTF. Detalhe em docs/calibracao-tumbler.md.

export type Violation = {
  kind: "SCHEMA" | "PROFILE" | "GEOMETRY" | "VISUAL" | "SEMANTIC";
  code: string;               // "UV_OVERLAP", "SCALE_MISMATCH", "VIEW_DIFF"...
  severity: "error" | "warn";
  nodePath?: string;
  view?: number;
  bbox2d?: Box;
  got: unknown;
  want: unknown;
};

// Invariantes:
// 1. Determinismo: (assetHash, profileHash, engineVersion) iguais ⇒ mesmos
//    rasters, mesmo verdict. Rasterizador de software pinado.
// 2. Tolerância mora no profile, nunca hardcoded.
// 3. Falha de infra ≠ reprovação: exit codes distintos, sem falso "passed"
//    (lição do CI do three.js).
// 4. Toda violação é acionável: código + local + got/want.
```

## Superfícies

1. **MCP server** — `judge_asset`, `judge_url`, `render_views`, `approve_baseline`. Entra no loop do Claude Code/Cursor.
2. **GitHub Action** — o gate: PR com relatório + stills anotados; baseline aprovado por humano.
3. **API/farm** — triagem em lote: N GLBs entram, relatório PASS/FAIL + métricas sai.
4. **Shell `npx judg3d`** — UI local: drop GLB / URL de cena / chat-gera via BYOK.

## Registry (o formato vencedor)

Não é galeria — galeria a Meshy Community já é. É **registry**: API/CLI-first.

- Asset só entra se passar no juiz; sai com verdict + manifesto de licença + hash.
- Consumo por ID com lockfile: agente/dev pede "cadeira julgada, <5k tris, licença CC-BY ou mais livre" e recebe artefato pinado.
- Selo público: "judg3d ✓" com métricas visíveis. Anti-slop por construção.
- Publicação v0: upload com auto-judge (ou PR-based no início, mais barato de moderar).
- Fontes legais de asset para o catálogo "free": (a) free tier de gen (CC BY 4.0, com cadeia de atribuição no manifesto), (b) weights locais, (c) procedural/código — o mais limpo, zero licença de terceiro.

### Licenças verificadas (2026-08-20)

- **Meshy**: plano pago = propriedade privada total do asset (perde exclusividade se publicar na comunidade); plano free = CC BY 4.0, irrevogável, comercial com atribuição (help.meshy.ai).
- **Tripo**: modelos públicos do free em CC BY 4.0; pagos com direitos amplos de uso/monetização (tripo3d.ai, termos de 2025-07-11).
- **Hunyuan3D / TRELLIS** (open weights): uso comercial de saída com poucas restrições segundo fontes secundárias — INCERTO, ler os termos exatos antes de prometer no catálogo.
- Implicação de produto: manifesto de licença por asset é obrigatório e casa com o verdict — proveniência + qualidade no mesmo carimbo.

## Trailer (primeiro artefato demo)

Cena 1: Claude Code escreve cena R3F; judg3d reprova com 3 violações (escala 10× fora do perfil, UV overlap, textura ausente) mostrando stills anotados; agente corrige sozinho; PR verde. Cena 2: lote de 50 GLBs de Hunyuan/TRELLIS triado com relatório. Um vídeo, uma thread.

## v0 NÃO faz

USD, QA de animação/rigging, física, repair automático (aponta, não conserta), plugin dentro de engine, marketplace de perfis, VLM como gate, contas/moderação sofisticada no registry.
# Semântica do primeiro release utilizável (0.1.0)

O recorte entregável é SCHEMA + PROFILE, CLI, MCP por stdio e app local.
GEOMETRY, VISUAL, SEMANTIC e herança de profiles continuam indisponíveis.
Pedir uma capacidade indisponível, desligar todas as camadas ou habilitar
PROFILE sem SCHEMA é erro de configuração (exit 2), sem veredito.

`failOn` usa a severidade original da Khronos após `severityOverrides`.
`report` controla apresentação: nunca altera aprovação nem oculta a severidade
que reprova. Information/Hint mantêm a severidade original em `got.severity`;
o contrato os apresenta como `warn`, mas eles não reprovam com `failOn: warn`.
O aviso sintético `ISSUES_TRUNCATED` também não reprova por si só.
`maxPerCode` resume o relatório após validar; `maxIssues` pode interromper a
validação Khronos. Nesse caso o resultado é incompleto e retorna infra (2).
Falhas internas do validator são infra; formato não reconhecido é SCHEMA FAIL.

`nodePath: ""` identifica o documento inteiro (JSON Pointer raiz), enquanto
`offset:N` identifica um byte no container. Violações de orçamento agregadas
apontam para a raiz. A cobertura declara explicitamente camadas não executadas;
PASS neste release não certifica aparência, geometria ou semântica.

Quando uma imagem não pode ser medida e maxTextureSize está definido, PROFILE
reprova com TEXTURE_METRICS_UNAVAILABLE no pointer da imagem. A métrica agregada
textures fica ausente em vez de usar zero ou reportar um máximo parcial.

## Language policy

English is the default product language, including CLI help, API/MCP errors,
diagnostic messages and JSON reports. The UI offers `en` and `pt-BR`, defaults
to English regardless of browser locale, and remembers an explicit selection
locally. Switching languages updates presentation without rerunning validation
or modifying the report. Technical diagnostics retain their original English.
Public documentation starts in English; historical project notes may remain
in Portuguese. Report detail keys use `usage` and `omitted` instead of the
Portuguese names from the unpublished candidate; violation codes are unchanged.

## Report boundary validation

A received report must declare at least one executed layer. Engine layers and
executed coverage agree in order; executed/skipped layers are unique, disjoint
and cover the five contract layers. A PASS cannot contain error-severity
violations, and a FAIL must contain a diagnostic. Violations refer only to
executed layers. Counters use nonnegative safe integers. Invalid reports are
rejected before presentation; these checks do not recompute asset acceptance.
Human-readable nested details use bounded traversal; the original JSON remains
complete. These are presentation/transport safeguards, not profile tolerances.
