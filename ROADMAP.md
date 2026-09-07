# Roadmap

This roadmap describes concrete next steps, not promised dates. The current
release covers SCHEMA and PROFILE through CLI, local HTTP/UI and MCP.

## Public 0.1.0 release

- Review and publish the MIT-licensed source and the tested package set.
- Enable private vulnerability reporting and require CI for merges.
- Demonstrate format failure, budget failure and infrastructure failure with
  reproducible inputs, hashes and explicit coverage.
- Invite independent users to reproduce the demo and report real integration
  problems. Record public feedback with permission, without claiming adoption
  from synthetic test runs or package reservation downloads.

## Make integrations easier

- Validate the documented setup in downstream projects using glTF/GLB assets.
- Expand fixtures for real exporter and validator edge cases, with redistribution
  rights, source versions and checksums recorded.
- Explore report comparison with an explicit design for profile/runtime changes;
  a baseline must never turn an unperformed check into PASS.
- Add CI integrations after real users identify useful environments and outputs.

## Broader asset checks

Geometry, rendering, baselines and semantic review need separate specifications,
validated dependencies and evidence. Do not advertise them as implemented.
Before adding visual judgments, define repeatable camera/rasterizer settings,
observable limitations and profile-controlled thresholds.

Useful first contributions include minimal reproductions, testing the clean
installation on another OS, improving onboarding and checking pt-BR UI strings.
Open an issue to coordinate work before building a large feature.
