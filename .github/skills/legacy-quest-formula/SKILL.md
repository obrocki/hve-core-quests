---
name: legacy-quest-formula
description: 'Create a fictional, offline-first legacy modernization playground and twelve HVE Core learning quests in a separate user-selected destination. Use when someone asks to generate or adapt a Windows 95-style legacy training exercise.'
argument-hint: 'system-name=<required> output=<required safe destination> [airline-name=<optional>] [airline-code=<optional 3-letter code>]'
license: MIT
user-invocable: true
metadata:
  authors: "HVE Core Quests contributors"
  spec_version: "1.0"
  last_updated: "2026-11-13"
---

# Legacy Quest Formula

## Goal

Generate a complete, fictional legacy-modernization exercise for a named system. The downstream playground belongs in a caller-selected destination separate from this repository's public formula skill and internal evaluation/support files. This repository supplies the formula and maintainer evidence, not a runnable application or duplicate source-template tree.

## Inputs and success criteria

Require a nonblank `SystemName` and an explicitly selected safe output destination. `AirlineName` and `AirlineCode` are optional; default them to High Velocity Eagle Airlines and `HVE`. A supplied code must be three uppercase letters. Use a new or empty destination; never overwrite existing work or choose a destination inside this skill repository. The default system is EagleDesk 95. Adapt names consistently when the caller provides different ones.

Success means the destination contains a locally working offline frontend; a plausible three-tier presentation, application, and data source layout; twelve connected quest briefs in the order in `references/quest-design.md`; supporting fictional documentation, graphical personas and backlog, and a real screenshot of the generated frontend. Include a clue manifest with twelve quest-specific markers and corresponding flag checks, a fast readiness checker, and a lightweight Vally suite with one quest-specific stimulus and expectation for each quest. The generated exercise's checker, suite, dependencies, and execution belong in its selected destination. This repository separately carries internal fixtures and a maintainer Vally suite that evaluates interpretation of those fixtures; those probes are not checks of a generated app. An optional connected runtime is separate and must not be required for the frontend to work locally.

## Generation flow

1. Confirm the required name and selected safe destination. Read `references/domain-pack.md`, `references/strata-notes.md`, `references/lore-and-personas.md`, `references/quest-design.md`, `references/output-layout.md`, `references/hve-core-map.md`, and `references/readiness-and-evidence.md`.
2. Create the downstream exercise directly in the selected destination. Use synthetic data only. Build its presentation, application, and data layers as a realistic source layout; keep the frontend functional without a backend, network, or container. A connected devcontainer runtime is optional.
3. Use only open-source libraries, components, and frameworks. Include license attribution for reused dependencies and assets in the generated output. Give the interface a Windows 95 battleship-gray desktop aesthetic without copying unlicensed assets.
4. Make the fictional repository feel deliberately aged: leave believable unfinished intern or contractor work, include a CEO's hurried demands, and seed useful hints and optional easter eggs. The chosen exemplar centers on seat holds, concurrency, overbooking, and a deliberate seat-14C race. Keep 1997 Classic ASP/VBScript/VB6 and T-SQL fossils inert. An optional connected path may use C# WebForms on open-source Mono/XSP, a .NET 8 API, PostgreSQL, and nginx; none is required for the offline frontend.
5. Generate the exercise documentation, all twelve quest briefs, graphical personas and backlog, a real screenshot captured from the generated frontend, the clue manifest and flag checks, the readiness checker, and the twelve-stimulus Vally suite. Inspect the result and verify that the offline frontend works. Run generated-output readiness and suite checks when their tools are available; keep Vally lint and probes distinct from native HVE execution and learner competency. Report unavailable model or runtime checks honestly.

## Handoff

Give the generated location, local launch instructions, quest 1 entry point, observed checks, and any limitations. State unavailable checks rather than implying they passed.

## Readiness and learner evidence

Keep checks lightweight. The generated readiness checker can confirm required files, links, screenshot, offline launch behavior, and clue-manifest consistency; clue markers, manifests, and flag checks support discovery and readiness only, never competency. The generated Vally suite has one stimulus and expectation per quest; suite lint checks its structure, while probes exercise the declared cases. Neither establishes native HVE execution or proves a learner completed a quest. Quest evidence is the learner's requested artifact or demonstrated work, assessed against that quest's objective. This repository's maintainer suite uses its own fictional Markdown fixtures and only smoke-checks whether their evidence is interpreted as expected. Report suite lint/probes, native tool use, model checks, and optional runtime checks separately.

## Safety and stop rules

Use synthetic people, passenger records, credentials, and business data only. Keep the intentionally flawed exercise local and isolated; do not deploy it publicly or present it as a production service. Stop before writing if the name or destination is missing, the destination is unsafe or nonempty, or the offline behavior cannot be verified. State the specific blocker instead of claiming success.

## References

- [Domain and generation contract](references/domain-pack.md)
- [Historical strata](references/strata-notes.md)
- [Lore and personas](references/lore-and-personas.md)
- [Twelve-quest sequence](references/quest-design.md)
- [Generated-output layout](references/output-layout.md)
- [Clue trail](references/clue-trail.md)
- [HVE Core practice map](references/hve-core-map.md)
- [Readiness and learner evidence](references/readiness-and-evidence.md)
- [Safety notes](SECURITY.md)
