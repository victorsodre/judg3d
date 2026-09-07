# Why a valid asset can still fail acceptance

A glTF exporter can produce a valid file that exceeds a project's material,
triangle or texture budget. A format validator answers whether the file conforms
to glTF; a pipeline also needs to decide whether it meets that project's policy.
judg3d preserves the existing Khronos validator and adds versioned rules,
actionable got/want diagnostics and automation-friendly verdict semantics.

## Historical motivation

The maintainer's [calibration notes](calibracao-tumbler.md) describe a 78-round
asset-authoring project, with **seven recorded judg3d executions**, all passing
the then-enabled SCHEMA checks. The notes describe an external material-budget
check finding 35 materials against a limit of 20. That observation motivated
bringing budgets into PROFILE.

The round count is not a judge execution count. These notes are a maintainer's
historical observation, not an independent benchmark, customer study or proof
of broad adoption. Raw authoring logs are not included in this repository.
They also record that visual defects could remain despite a format PASS.

## Reproduce the distinction today

Run `pnpm demo`. The same immutable 12-triangle Box passes SCHEMA and fails a
profile with a four-triangle example budget. A broken Box fails with localized
format diagnostics. A missing profile returns infrastructure failure without a
verdict. Reports include hashes and explicit coverage and are checked for
repeatability. See the [demo](../examples/acceptance-gate/README.md).

This test establishes a narrow technical capability. It does not establish a
reduction in artists' work, performance across a population of assets, independent
users or successful visual repair. Those claims need additional evidence.

## Evidence worth collecting next

A useful external pilot would identify a real pipeline and fixed profile,
record assets judged and findings acted on, distinguish false alarms from
confirmed defects, and report repeat runs separately from unique assets.
Publish a small reproducible example and feedback only with the participant's
permission. That would strengthen the product and its open-source contribution
more than an inflated adoption number.
