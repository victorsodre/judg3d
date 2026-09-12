# @judg3d/core

Verdict, Violation, JudgeReport and CompareDocument contracts, strict profile
loading, SHA-256 hashes and deterministic judg3d serialization.

`@judg3d/core/present` provides browser-safe report/compare validation and formatting.
Do not import the package root in the browser: it uses Node APIs.
Presentation helpers default to English; `formatBytes` and `violationDetail`
accept an optional `"pt-BR"` locale for interface presentation. Original layer
diagnostics and canonical JSON are not translated.
