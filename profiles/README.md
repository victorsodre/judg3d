# Profiles

A profile is the pipeline owner's versioned acceptance contract. Different
projects need different budgets, so acceptance thresholds belong here rather
than in judge code.

## web-commerce v0.1.0

This profile enables SCHEMA only. PROFILE is implemented but intentionally
disabled here: there is no universal triangle budget for commerce assets.
Enable PROFILE and select limits appropriate for your pipeline.

| Key                               | Effect                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `layers.schema.failOn`            | `error` fails on validator errors; `warn` also fails on warnings                                              |
| `layers.schema.report`            | Report verbosity; does not hide a failing severity or change the verdict                                      |
| `layers.schema.ignoredIssues`     | Validator codes to ignore, such as `["UNUSED_OBJECT"]`                                                        |
| `layers.schema.severityOverrides` | Code → Khronos severity: `0` Error, `1` Warning, `2` Information, `3` Hint                                    |
| `layers.schema.maxIssues`         | Khronos global issue limit; truncated validation returns infrastructure failure. `0` is unlimited             |
| `layers.schema.maxPerCode`        | Post-validation occurrence cap; `ISSUES_TRUNCATED` declares omissions without independently failing the asset |

The schema is strict: unknown keys return exit 2. Enabling an unimplemented
layer (`geometry`, `visual`, `semantic`) also returns exit 2. Their configuration
keys are reserved for future implementation.

## agent-loop v0.1.0

An example profile for iterative asset authoring with an agent. Enables SCHEMA
and PROFILE. Limits came from a specific project (`tumbler-three`): 350,000
triangles, 60 draw calls, 20 materials and image dimensions up to 2048 px.
Copy and adapt them; they are not universal judg3d defaults.

| Key                                     | Effect                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `layers.profile.failOn`                 | Rejection threshold independent of SCHEMA failOn                         |
| `layers.profile.budgets.maxTriangles`   | Triangle limit; `null` disables                                          |
| `layers.profile.budgets.maxVertices`    | Vertex limit; `null` disables                                            |
| `layers.profile.budgets.maxMaterials`   | Material limit; `null` disables                                          |
| `layers.profile.budgets.maxDrawCalls`   | Draw-call limit; `null` disables                                         |
| `layers.profile.budgets.maxTextureSize` | Largest image dimension in pixels; `null` disables                       |
| `layers.profile.budgets.nearLimit`      | Budget usage fraction that triggers an early warning; `0` disables       |
| `layers.profile.requireSelfContained`   | Reject resources whose storage is not `glb`, `buffer-view` or `data-uri` |
| `layers.profile.severityByCode`         | Diagnostic code → `error` or `warn`; defaults to `error`                 |

A pipeline can treat an exceeded budget as feedback during authoring:

```json
"severityByCode": { "MATERIALS_OVER_BUDGET": "warn" }
```

Whether that warning rejects the asset depends on the layer's `failOn`.
`METRICS_UNAVAILABLE` and `TEXTURE_METRICS_UNAVAILABLE` cannot be downgraded;
a requested check without measurements must never silently pass.

**`null` differs from `0`.** Null means unlimited; zero rejects any positive
value for that metric. A valid glTF can reference external files, so
`requireSelfContained` adds a portability requirement beyond format validation.
For the original calibration rationale, see
[docs/calibracao-tumbler.md](../docs/calibracao-tumbler.md) (Portuguese).

`extends` must be `null`: inheritance is not implemented. PROFILE requires
SCHEMA. At least one layer must be enabled.

Diagnostics and JSON fields are English regardless of interface language.
The unpublished 0.1.0 candidate uses `got.usage` and `got.omitted` instead of
the earlier Portuguese keys. Diagnostic codes and acceptance rules are unchanged.
