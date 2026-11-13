---
name: legacy-quest-formula
description: 'Create a fictional, offline-first legacy modernization playground and twelve HVE Core learning quests in a separate user-selected destination. Use when someone asks to generate or adapt a Windows 95-style legacy training exercise.'
argument-hint: 'system-name=<required> output=<required safe destination>'
license: MIT
user-invocable: true
metadata:
  authors: "HVE Core Quests contributors"
  spec_version: "1.0"
  last_updated: "2026-11-13"
---

# Legacy Quest Formula

## Goal

Generate a complete, fictional legacy-modernization exercise for a named system. The downstream playground belongs in a caller-selected destination separate from this instruction-only skill repository. This repository supplies the formula, not an application, generator, template, or ready-made quest instance.

## Inputs and success criteria

Require a nonblank `SystemName` and an explicitly selected safe output destination. Use a new or empty destination; never overwrite existing work or choose a destination inside this skill repository. The default exemplar is High Velocity Eagle Airlines (`HVE`), with the fictional system called EagleDesk 95. Adapt names consistently when the caller provides different ones.

Success means the destination contains a locally working offline frontend; a plausible three-tier presentation, application, and data source layout; twelve connected quest briefs in the order in `references/quest-design.md`; supporting fictional documentation, graphical personas and backlog, and a real screenshot of the generated frontend. Any optional connected runtime is separate and must not be required for the frontend to work locally.

## Generation flow

1. Confirm the required name and selected safe destination. Read `references/domain-pack.md`, `references/strata-notes.md`, `references/lore-and-personas.md`, `references/quest-design.md`, `references/hve-core-map.md`, and `references/readiness-and-evidence.md`.
2. Create the downstream exercise directly in the selected destination. Use synthetic data only. Build its presentation, application, and data layers as a realistic source layout; keep the frontend functional without a backend, network, or container. A connected devcontainer runtime is optional.
3. Use only open-source libraries, components, and frameworks. Include license attribution for reused dependencies and assets in the generated output. Give the interface a Windows 95 battleship-gray desktop aesthetic without copying unlicensed assets.
4. Make the fictional repository feel deliberately aged: leave believable unfinished intern or contractor work, include a CEO's hurried demands, and seed useful hints and optional easter eggs. The chosen exemplar centers on seat holds, concurrency, overbooking, and a deliberate seat-14C race. Historical Microsoft-stack source-only fossils may be represented as downstream exercise evidence; do not make obsolete services a runtime dependency.
5. Generate the exercise documentation, all twelve quest briefs, graphical personas and backlog, and a real screenshot captured from the generated frontend. Inspect the result, verify that the offline frontend works, and report only checks actually performed.

## Readiness and learner evidence

Keep checks lightweight. A skill/output smoke check may confirm the destination, required files, links, screenshot, and offline launch behavior; it does not prove a learner completed any quest. Quest evidence is the learner's requested artifact or demonstrated work, assessed against that quest's objective. Distinguish both from model evaluation, HVE Core tool invocation, and optional connected-runtime checks.

## Safety and stop rules

Use synthetic people, passenger records, credentials, and business data only. Keep the intentionally flawed exercise local and isolated; do not deploy it publicly or present it as a production service. Stop before writing if the name or destination is missing, the destination is unsafe or nonempty, or the offline behavior cannot be verified. State the specific blocker instead of claiming success.

## References

- [Domain and generation contract](references/domain-pack.md)
- [Historical strata](references/strata-notes.md)
- [Lore and personas](references/lore-and-personas.md)
- [Twelve-quest sequence](references/quest-design.md)
- [HVE Core practice map](references/hve-core-map.md)
- [Readiness and learner evidence](references/readiness-and-evidence.md)
- [Safety notes](SECURITY.md)
