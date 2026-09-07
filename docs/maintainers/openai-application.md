# Codex for Open Source: preparation record

Checked on 2026-09-07 against the [program overview](https://developers.openai.com/community/codex-for-oss),
[application form](https://openai.com/form/codex-for-oss/) and linked program terms.
This is a preparation record and editable draft, not an application submission
or an affiliation claim.

## What matters

The official form asks for a public GitHub profile/repository, maintainer role,
and evidence of usage or ecosystem value. Selection considers meaningful use,
adoption, relevance and ongoing maintenance. There is no published promise of
acceptance based on a license choice, test count or repository checklist.

The three narrative answers in [application-draft.json](application-draft.json)
are limited to 500 characters each by the current form. `pnpm docs:check`
validates those limits. Account email and organization ID belong in the official
form, not the repository. Read the current terms before submitting.

## Observed position

The initial preparation snapshot was private with zero stars and zero forks.
On 2026-09-07, `victorsodre/judg3d` became public under MIT after historical privacy
cleanup. The source is public; independent adoption is not yet established.
Contributions by the primary maintainer and an AI tool account do not establish
a community of independent maintainers. The functional 0.1.0 package set remains
an unpublished npm candidate; the 0.0.1 npm artifact is a placeholder.
Its download count would not measure adoption of the working validator.

The current evidence establishes a working deterministic acceptance gate,
regression tests, local UI/MCP integration and reproducible package installation.
[Historical observations](../case-study.md) explain the motivation but do not
establish broad ecosystem importance. MIT and contributor/security policies
remove practical onboarding barriers; they do not create usage by themselves.

## Public technical evidence

- [Initial public candidate](https://github.com/victorsodre/judg3d/commit/26de491f56e52a0b738b5c1a0db5f9a79bd3c86c).
- [Passing CI](https://github.com/victorsodre/judg3d/actions/runs/34081809801): 121 tests,
  type checking, lint, documentation checks, clean package installation and demo
  on Linux with Node 22.13/24/26 and macOS with Node 26.
- [Passing history secret scan](https://github.com/victorsodre/judg3d/actions/runs/34081809768).
- Public README, MIT license and demo were retrieved without authentication.
  Private vulnerability reporting and secret push protection are enabled.

These are dated technical results. Recheck the latest revision and actual usage
before submitting; repository publication does not itself demonstrate adoption.

## Stronger evidence to collect

- Continued passing CI tied to each release's exact source revision.
- An independent developer reproducing the demo or integrating a real pipeline.
- Public bug reports, reviewed contributions and fixes that show maintenance.
- A consented case study recording unique assets, decisions acted on and
  limitations; count reruns separately and avoid implied visual validation.

These are useful product outcomes, not an invented eligibility threshold.
Stars or staged activity should not be manufactured to support the application.
A project can explain a specialized ecosystem contribution honestly even while
small, as the program guidance permits.

## Proposed use of support

The draft proposes bounded, human-reviewed assistance with regressions, triage
and releases. This is a future use plan, not automation already deployed.
No credits have been requested, no paid calls run and no form submitted during
preparation. Release/publication and the application require explicit owner
approval after review of the concrete artifacts.
