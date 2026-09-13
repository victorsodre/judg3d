# External trial shortlist (independent adoption)

Passport gap: **independent people trying one of their own assets**. Maintainer demos,
Fusquinha, and other `victorsodre` repos are useful proof of life — they are **not**
independent evidence. Do not send DMs or posts from this list until Victor says go.
Prefer verified public orgs/handles; leave blanks as research notes rather than inventing
people.

Tester guide for every invite: [tester-guide.md](tester-guide.md). Feedback:
[feedback-template.md](feedback-template.md).

## Priority A (DM-ready when Victor says go)

| Who | Why fit | Channel | Suggested first ask (1 line) | Status |
| --- | --- | --- | --- | --- |
| **google/model-viewer** maintainers / Discussions | Ships GLB→web/AR for commerce; budgets and self-contained assets matter | GitHub Discussions / issues (public); X research for current maintainers | Would you try one nonconfidential product GLB with `web-commerce` and say if the report helps a shipping decision? Asset: storefront/AR product GLB. Guide: [tester-guide.md](tester-guide.md) | |
| **Shopify 3D / Hydrogen theme** author or agency (role; research needed for a named person) | Native GLB product media + AR; triangle/texture budgets are real delivery constraints | Email / LinkedIn once identified; Shopify community forums as backup | Can you run judg3d on one export you already hand to Shopify and tell me if PASS/FAIL matches your QA bar? Asset: a product GLB destined for `model_viewer_tag`. Guide: [tester-guide.md](tester-guide.md) | |
| **@vntana/viewer / VNTANA** engineering (org; research needed for a named contact) | Commerce/AR viewer; cares about delivery size and validity | GitHub / product site contact / X `@vntana` research | Would you judge one catalog GLB against a triangle+bytes profile and say whether the report is actionable? Asset: a viewer demo or catalog GLB. Guide: [tester-guide.md](tester-guide.md) | |
| **Needle Engine** (`needle-tools`; `@marwie` / `@hybridherbst` on GitHub) | Unity/Blender→web GLB pipelines with LODs and budgets | Discord [discord.needle.tools](https://discord.needle.tools) or GitHub | Mind trying one Needle-exported GLB with a custom budget profile? Asset: a Needle Cloud / project export. Guide: [tester-guide.md](tester-guide.md) | |
| **pmndrs / gltfjsx** circle (`@drcmda` / Poimandres Discord) | Turns GLB into R3F components; users already fight file size | Discord (Poimandres / three.js) or GitHub | Would you run `judge` on a GLB you were about to feed to gltfjsx and share what the report got wrong? Asset: an R3F-bound GLB. Guide: [tester-guide.md](tester-guide.md) | |
| **basementstudio/mcp-three** maintainers | MCP that puts GLB→JSX in agent loops (Cursor/Claude users) | GitHub | Open to trying judg3d as a pre-step before `gltfjsx` in an agent loop on one asset? Asset: any GLB you convert via MCP. Guide: [tester-guide.md](tester-guide.md) | |
| **r3f-mcp** maintainers (`r3f-mcp/r3f-mcp`) | Live R3F scene MCP for Cursor/Claude — 3D already in the loop | GitHub | Would you judge one scene asset with the MCP or CLI and note whether the verdict helps before codegen? Asset: a scene GLB used with the provider. Guide: [tester-guide.md](tester-guide.md) | |
| **donmccurdy / glTF-Transform** (`@donmccurdy`; X research `@donrmccurdy`) | de-facto glTF tooling; compare-before/after after optimize is a natural fit | GitHub / X | Curious whether `judg3d compare` on a before/after `gltf-transform` optimize is useful feedback for your users? Asset: any optimize pair. Guide: [tester-guide.md](tester-guide.md) | |
| **Khronos glTF-Validator** adjacent maintainers / glTF WG commenters (role; research needed) | Schema layer already overlaps; PROFILE budgets are the complementary ask | GitHub `KhronosGroup/glTF-Validator` or [Khronos forums](https://community.khronos.org/c/gltf-general/45) | Would you try judg3d on one sample and comment whether PROFILE budgets belong beside the Validator? Asset: a Khronos sample or your own test GLB. Guide: [tester-guide.md](tester-guide.md) | |
| **r/threejs** (community post, not a DM) | High density of people shipping GLB to the browser | Reddit | Short post: local acceptance gate for GLB budgets — looking for 3 people to try one asset this week. Point to tester guide + demo. Asset: theirs. Guide: [tester-guide.md](tester-guide.md) | |
| **three.js Discord** (community channel, not a DM) | Official community; many indie WebGL/AR builders | Discord [invite](https://discord.gg/HF4UdyF) | Share the FAILED→PASSED demo + ask for one-asset trials; link tester guide. Asset: theirs. Guide: [tester-guide.md](tester-guide.md) | |
| **Khronos glTF Discord / forums** (community post) | Spec-adjacent audience that already validates assets | [khr.io/khrdiscord](https://khr.io/khrdiscord) / [forums](https://community.khronos.org/c/gltf-general/45) | Post: SCHEMA via Khronos + configurable PROFILE budgets; seeking independent trials, not endorsements. Asset: theirs. Guide: [tester-guide.md](tester-guide.md) | |
| **Patada!** (indie game studio, BR) | BR studio shipping PC/web/mobile; 2D/3D client work | Site contact [patada.studio](https://www.patada.studio/) | Posso te pedir 15–20 min com um GLB não confidencial do pipeline de vocês? Asset: qualquer GLB de jogo/web. Guide: [tester-guide.md](tester-guide.md) | |
| **Saphire Game Studio** (indie, SP/BR) | BR indie narrative/gameplay studio — possible WebGL/export pipeline | Site [saphiregamestudio.com.br](https://saphiregamestudio.com.br/) / research for a named contact | Convite curto: trial de um asset próprio com perfil de budget. Asset: export de personagem/prop. Guide: [tester-guide.md](tester-guide.md) | |
| **BR WebGL / R3F indie** (e.g. browser experiences like Anedolia — verify current handle before DM) | BR creators shipping GLTF in the browser; Victor is BR | GitHub / LinkedIn once verified | Trial de 15–20 min com um GLB do seu projeto web. Asset: scene/character GLB. Guide: [tester-guide.md](tester-guide.md) | |
| **victorsodre/fusquinha** (live Action example) | Real GLB + `judg3d-gate` workflow — **internal proof only** | n/a (do not count as independent) | Already wired; use as CI screenshot for “how a gate looks,” never as passport adoption. Asset: Fusquinha GLBs. Guide: n/a for external cite | **internal — not independent evidence** |

### Per-row asset + guide reminder

Every Priority A invite (except Fusquinha) should point the person at:

1. One of **their** nonconfidential GLB/glTF files (product, scene, or export).
2. Profile starting point: bundled `web-commerce` or a copied budget JSON.
3. [tester-guide.md](tester-guide.md) — 15–20 minutes, local only.

## Priority B (later)

- **zeux / meshoptimizer / gltfpack** — compression tooling adjacent; ask only after a few successful external trials (GitHub).
- **Codefluss / Shopify 3D configurator** authors — commerce configurators with Draco/budget advice; research a named maintainer.
- **LatAm web3D studios outside BR** (e.g. basement.studio proper, not only mcp-three) — warm intro via MCP row first.
- **Cursor / Claude / Codex power users** who already generate or edit GLB in agent loops — find via public MCP configs or Discord shares; no invented handles.
- **glTF Sample Models / Sample Viewer** contributors — comment-only asks after Khronos forum post.
- **BR agencies** that deliver AR for retail (research needed: São Paulo e-commerce 3D vendors) — email once a public contact exists.
- Repos that already run Khronos Validator or `gltf-transform` in CI — search GitHub for workflow matches; invite to add PROFILE budgets beside SCHEMA.

## Pack for each invite

- Repo: https://github.com/victorsodre/judg3d
- Release: **npm `judg3d@0.2.0`** — `judge`, `compare`, `app`, `mcp`, profiles, and the reusable Action consumer path.
- Demo video: `artifacts/repair-loop/demo-judg3d-0.2.mp4` (FAILED→PASSED triangle-budget repair-loop).
- Tester guide: [tester-guide.md](tester-guide.md)
- Feedback template: [feedback-template.md](feedback-template.md)
- Honest capability note:
  - `judg3d compare` and optional **GitHub Action PR comments** (`judg3d-gate`) exist on **main**.
  - **`judg3d fix` is on main** (merged after the 0.2.0 cut; see Unreleased in CHANGELOG). **npm 0.2.0 does not include `fix` yet** — use a source checkout (`pnpm build && pnpm judg3d fix …`) or wait for the next publish. Do not claim auto-remesh; plan/`--apply` is limited safe transforms (e.g. extras stripping), not geometry remeshing.
- Outreach copy: [outreach.md](outreach.md)

## Tracking

Keep private contact details out of git. Minimal checklist per target:

| Target | Invited | Tried | Feedback | Permission to cite | Independent (Y/N) |
| ------ | ------- | ----- | -------- | ------------------ | ----------------- |
| … | | | | | |

Rules of thumb:

- Fusquinha / any `victorsodre` repo → Independent = **N**.
- A guided screen-share with Victor driving → Independent = **N** (note assistance).
- Someone installs from npm or source, runs one of their assets, and returns the template → Independent = **Y** only after that happens.
