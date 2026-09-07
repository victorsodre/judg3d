---
tags: [project/judg3d, calibration]
updated: 2026-08-22
---

# Calibration against a real pipeline — 78 project rounds, 7 recorded runs

`judg3d` ran as an acceptance gate inside `tumbler-three`, an agent-led,
closed-loop 3D modeling project, between 2026-08-21 and 2026-08-22. It had
seventy-eight rounds, each with an independent blind critic and written record.

This document retains what was useful. The raw notes, with 35 numbered
hypotheses, are in `tumbler-three/gauntlet/judg3d-notas.md`.

## The number that opens the report

| | |
|---|---|
| Project rounds | **78** |
| Recorded judge runs | **7** |
| `exit 0` | **7** |
| `exit 1` | **0** |
| `exit 2` | **0** |
| Critic rejections during the period | **~30** |
| Defects found only by the critic | **all but one** |

No `exit 2` occurred in the **seven recorded runs** in this sample. That does
not demonstrate execution, or absence of failures, across all 78 project
rounds. This is a historical maintainer record; the raw logs are not in this
repository, and the figures do not represent independent adoption or a
benchmark.

The remainder exists to address what those results exposed.

## The four calibration hypotheses

**H1 — “L1 rejects almost nothing in an authoring pipeline”: confirmed.**
There were zero `exit 1` results in the seven recorded runs. The 78 rounds
belong to the authoring project; this sample does not contain 78 judg3d
verdicts. L1 remains essential for third-party assets, but for a person or
agent that *creates* the asset, it is a gate that rarely closes.

**H2 — “the first real defect will be budget, not validity”: confirmed, with a
correction.** It was neither triangle count nor draw calls; it was
**materials**. There were 35 against a limit of 20, **75% over**, while
triangles used **0.7%** of their limit and draw calls used 58%.

The detail that decided this session was that **the gate lived outside
judg3d**, in a project script. The only defect caught by an automated check in
78 rounds was caught by a rule the judge did not have. That motivated L2.

**H3 — “a material metric will be missing”: confirmed, and more strongly than
stated.** The change that altered the image most over twenty rounds —
`baseColorFactor` from 0.0075 to 0.05 — produced **two identical rows** in the
metrics series. Counting materials says nothing about their content.

**H4 — “empty nodes and orphan hierarchies will not be caught”: untested.**
The model never had a pivot node without geometry. The question remains open.

## What entered this session

### L2 PROFILE — budgets

This brings the only automated check that worked across 78 rounds into the
judge. Five limits are optional and profile-controlled:

```
maxTriangles · maxVertices · maxMaterials · maxDrawCalls · maxTextureSize
```

`null` disables a limit. The distinction between *no limit* and a *zero limit*
is explicit, so an omitted field cannot silently reject everything.

### L2 PROFILE — self-containment

`requireSelfContained` rejects a resource outside the container. The relevant
information was already in the validator report (`info.resources[].storage`),
so implementation required a string comparison.

This is an **L1 gap, not an L2 novelty**: a GLB with an external URI is valid
glTF, so the validator does not report it. It works on the exporter’s machine
and fails elsewhere. This is exactly the kind of silent defect L1 needs to
catch.

The `storage` values were confirmed **empirically** against validator
2.0.0-dev.3.10, rather than inferred from documentation: `glb`, `buffer-view`,
and `data-uri` retain a resource in the container; every other value points
outside it.

### `MeshMetrics.textures` — the partial answer to H3

`{ count, maxSize }` comes from `info.resources[].image`. It is absent, rather
than zero, when an asset has no image.

It is the first **content** attribute of a material that can be measured
without parsing glTF JSON. It does not close H3, but changes a metrics row from
“35 materials” to “35 materials, 12 textures, largest 4096,” and the second
sentence is actionable.

### `severityByCode` — severity moves into the profile

The first version of this layer emitted every violation as `error`, which made
it unusable in the loop that motivated it. `tumbler-three` treats a budget
overrun as a **gap to close before delivery**, rather than a reason to stop a
round. With fixed severity, a model with 45 materials would reject every later
round without adding information beyond the first.

The choice moved to the profile, with `error` as the default: silence must be
requested, never inherited. `METRICS_UNAVAILABLE` cannot be downgraded.

### `got`/`want` visible in human output

The first budget violation printed only `MATERIALS_OVER_BUDGET`, without its
number. Specification invariant 4 says every violation is actionable — code,
location, and `got`/`want` — but CLI output only knew how to render
`got.message`, because until then every violation came from L1 and carried a
message.

> The gap existed from the start and surfaced only when a violation without
> `message` arrived. An invariant that has never been exercised is not assured.

## What stayed out, and why

**Duplicate materials.** The finding with the calibration’s strongest number:
35 materials for 21 distinct meshes, of which 24 were four repeated variants
used six times. A `uniqueMaterials` metric would have returned **11 against
35**.

It did not enter because it requires reading the glTF JSON `materials` array,
which validator `info` does not expose. Reading the JSON chunk of a GLB means
writing a format parser, which `AGENTS.md` forbids for good reason.

**Victor’s decision, not mine:** adopting a dependency that already reads glTF
(`@gltf-transform/core` is the obvious candidate, and the specification already
anticipates “Auditor + extensions”) would unlock all of these at once:

- duplicate and unused materials — **H3**
- nodes without geometry and orphan hierarchies — **H4**, still untested
- linear `baseColorFactor` reflectance — the `#14161A` at 0.0075 that took four
  critic rounds to isolate by hand
- texel density and UVs, which the specification already lists under L2

Without it, L2 is limited to what `info` supplies, which is what is currently
implemented.

## The first production asset broke the judge

On 2026-08-22, `judg3d` ran for the first time against a real GLB — 202,326
faces, 14 materials, 20 textures, 35 MB — instead of 12-triangle boxes and
code-generated scenes.

It failed. The following is the **original historical CLI output in
Portuguese**:

```
judg3d: falha inesperada — RangeError: Maximum call stack size exceeded
Isto e uma falha de infraestrutura (exit 2), nao uma reprovacao do asset.
```

English translation: “judg3d: unexpected failure — RangeError: Maximum call
stack size exceeded. This is an infrastructure failure (exit 2), not an asset
rejection.”

**The classification was correct**, and deserves to be recorded as such: exit
2, infrastructure, not rejection. Invariant 3 worked exactly as written on a
path that had never been exercised.

### Cause

`violations.push(...result.violations)`.

Spread passes **every element as an argument**, and a function call has an
argument limit — in practice between 60,000 and 125,000 in V8. The validator
returned **632,379** violations for that asset.

> User-controlled input size must never become a function argument-list size.
> A loop has no such limit; a call does.

The bug had existed since L1. No fixture contained more than four violations,
so nothing exercised it: the same form as H29 and H33, where **the tool is not
checked against the case it exists to handle.**

### The second defect, visible only after fixing the first

Of the 632,379 violations, **632,332 had the same code**
(`ACCESSOR_JOINTS_USED_ZERO_WEIGHT`). A report with hundreds of thousands of
identical lines is actionable for neither an agent nor a person. Invariant 4
fails by volume rather than content.

`maxIssues` did not solve this: it cuts the **total**, so a limit of 500 would
return 500 copies of the most frequent code and **none** of the other four.

`maxPerCode` was added to preserve **diversity**. A report becomes actionable
through the number of distinct problems it identifies, not through its line
count. Omitted findings are declared in an `ISSUES_TRUNCATED` violation with a
count by code, because silent truncation reads as *“everything is here.”*

The result for the same asset was a **32 KB report with 65 violations**,
covering the five distinct codes, rather than a file hundreds of megabytes
large.

The default is `0` (unlimited), so prior behavior is unchanged for consumers
that did not request a limit.

## The round-200 report — what its consumer had to build alone

On 2026-08-23, the project generated a complete report for the finished model
(311,784 triangles, 46 meshes, 9 materials). Read another way, it is a
**feature list with a working prototype**: each valuable thing in it that
judg3d does not produce is a request with attached evidence.

### What entered this session

**`nearLimit`.** The report said only `OK` for `311,784 triangles out of
350,000`. That is **89.1%**, leaving no room for the next part.

> `OK` and `OK at 89% of the limit` lead to different decisions, but the
> report could only say the first. Passing the limit is too late; nearing it is
> when a decision is still possible.

A profile fraction of the limit (0 disables it) changes the metric into
`<METRIC>_NEAR_BUDGET` with `warn` severity. Every budget violation also gained
`usage`: `35 materials` becomes `35 materials, 175% of the limit`.

**`coverage` in the envelope.** The report independently stated the following;
the quote is preserved as **original historical output in Portuguese**:

> *“o judg3d aprova **conformidade**, não aparência. Um modelo pode estar
> APROVADO e ainda assim ser reprovado pelo critic — é exatamente o estado
> atual.”*

English translation: “judg3d accepts **conformance**, not appearance. A model
may be APPROVED and still be rejected by the critic — that is exactly the
current state.”

This happened in practice: `APPROVED — 0 errors, 0 warnings` on the same model
that a blind critic rejected with 4 · 3 · 5 · 3. **The report was truthful but
misleading by omission.**

The envelope gained `ran` and `skipped`, and the CLI printed the following
**original historical output in Portuguese**:

```
NAO coberto: GEOMETRY, VISUAL, SEMANTIC — este veredicto e sobre
             conformidade, nao aparencia
```

English translation: “NOT covered: GEOMETRY, VISUAL, SEMANTIC — this verdict
is about conformance, not appearance.”

A disabled layer did **not pass**; it did not run. The distinction must be in
the output, rather than in the reader’s head.

### What did not enter, for the same reason as before

The richest part of the report is the **triangle distribution by part and
material** — `roda_traseira_esquerda 49 580 (15,9%)`, `pneu 99 160 em 2 peças`.
It turns a total into a decision: *“54% of the budget is in tires, and that is
deliberate.”*

The original field examples are retained verbatim as historical evidence; the
English names are “left rear wheel 49,580 (15.9%)” and “tire 99,160 in 2
parts.”

`judg3d` cannot produce this distribution. Validator `info` supplies totals
only, and the project obtained the distribution from **Blender**, not the GLB:
a Python script in the DCC, outside the judge.

For the judge to produce it, it must read the glTF `meshes` array, which is the
dependency discussed in *“What stayed out, and why.”* This report is its
strongest argument yet: **this is not a metric that would be nice to have; it
is one the user already implemented elsewhere because it was needed.**

That dependency would also bring duplicate materials (H3) and orphan nodes
(H4), the two hypotheses that remain untested.

## The structural finding — and it is not about 3D

Most of the 35 hypotheses do **not** ask for a smarter judge:

> **An acceptance judge improves more by being required to state how it knows
> than by knowing more.**

Eight of the first fifteen are solved with **required fields in an output
contract**. No additional computation and no better model are required.

There is a second, stronger pattern: **seven blind spots, all belonging to the
person running the loop, none belonging to the judge, all resolved by counting
between rounds.** In all seven, the data was already in the repository.

> **The judge reported. The system had nowhere to retain what was reported and
> not addressed.**

### Where this belongs in judg3d

Many of these hypotheses describe a **model-based** judge — the blind critic —
not deterministic judg3d. Their place in the specification is **L5 SEMANTIC**,
and they are the best requirements list that layer will have.

Two belong in judg3d as it exists today, and neither requires a renderer:

**1 · Memory between verdicts.** A `--baseline <report.json>` that compares the
current verdict with the prior one and returns, for each finding, how many runs
it has persisted. A finding on its eighth appearance cannot be presented as
new. It is counting, it is deterministic, and it eliminates four of the seven
blind spots.

**2 · Derived effective resolution, never declared.** When L4 exists:
`px/m = frame_width / (2 · distance · tan(fov/2) · aspect)`. Each criterion
declares a minimum, and an artifact below it returns `unresolvable` instead of
a score.

> Judging finish where 20 mm occupies 2.5 px is not judging poorly. It is
> judging **nothing**, with a score that looks like a score. A low score and
> `unresolvable` send the reader in opposite directions: the former says to
> change the model, the latter says to change the camera.

## The most serious product defect

The judge ran **7 times in 78 rounds** because the project executed it only
when the asset changed, while most rounds in an agent loop do not change the
asset.

The side effect is worse than absence: a reader sees
`001 → 008 → 012 → 020 → 031 → 035 → 037` and **cannot distinguish “it did not
run” from “it ran and the asset is unchanged.”** There is not a single line
between round 037 and 078.

> A judge that appears only when someone calls it is not a gate; it is
> consultancy.

The fix is inexpensive, and half already exists: `judge-report.json` **already
carries `asset.sha256`**. The consumer needs to record it in the series, and
the CLI needs a mode that answers `unchanged (same sha)` instead of simply not
running.

## Suggested order for the next session

1. **A glTF-reading dependency** — unlocks H3, H4, and half of the L2 work the
   specification already describes. It is the highest-leverage decision and
   belongs to Victor.
2. **`--baseline` with recurrence counting** — the report’s strongest
   structural finding, with no renderer required.
3. **L4 VISUAL with derived resolution** — the previously planned rasterizer
   session, now with `unresolvable` in the contract from day one.
