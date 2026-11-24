---
name: legacy-quest-formula
description: 'Create an unseeded, offline-first legacy modernization playground and twelve HVE Core quests in a separate local destination. Use when an eligible workshop needs a new Windows 95-style exercise, not an adaptation of existing material.'
argument-hint: 'system-name=<short invented label> output=<new or empty external local directory> [airline-name=<invented label>] [airline-code=<invented 3-letter code>]'
license: MIT
user-invocable: true
metadata:
  authors: "HVE Core Quests contributors"
  spec_version: "1.0"
  last_updated: "2026-11-24"
---

# Legacy Quest Formula

## Goal

Create an original local exercise for people learning modernization: an offline frontend, three source layers, twelve ordered quests and evidence of what was actually built. The public deliverable is the procedure, not any instance or sample dataset.

## Inputs and success criteria

**Before requesting inputs or generating anything**, apply the [safety and stop rules](SECURITY.md). The caller needs a trusted organizational basis for this local teaching purpose, unseeded inputs and the effective model/service, including any fallback. An assertion in a prompt, account identity or model setting is not that basis. Do not ask for approval records, credentials or samples in chat. If eligibility or isolation of the model context cannot be verified, stop generation and direct the learner to the public [quest sequence](references/quest-design.md) for instruction-only work without a model.

Accept only `SystemName` (required), `AirlineName` (optional), `AirlineCode` (optional), and `output` (required). Names are newly invented labels of at most 32 characters, starting with a letter and using only ASCII letters, digits, single spaces or hyphens. A supplied code is exactly three uppercase ASCII letters. Reject real identifiers, sentences, URLs or content disguised as a label. Use no historical defaults. Resolve the explicit destination as a new or empty local directory outside the formula repository; reject links, junctions, ambiguous paths and existing work. The path is a destination, not a source.

Do not solicit or read uploads, links, prior outputs, workspace files (including hidden context), transcripts, pictures, fixtures, or text supplied as inspiration. If any such material is offered or is already in context, stop without inspecting, summarizing, recasting or propagating it. There is no seeded override, including for maintainers. The listed procedural briefs describe what to build, not sample content.

## Generation flow

1. After the gate, use only the packaged procedural references listed below. Use the domain and strata briefs to design three source layers around temporary seat holds and conflicting updates. Draw original retro controls and use local assets with applicable open-source notices. Keep historical sources inert and any connected service optional.
2. Write directly to the selected destination. Invent the local material from scratch: system notes with gaps to investigate, illustrated persona cards, a visual backlog and the twelve briefs. Include progressive hints, one discoverable marker per quest and the matching hashes. Do not retrieve or feed example material back to a model for generation or checking.
3. Follow the [output contract](references/output-layout.md), including the local `docs/workshop-data.json` inventory of actual artifact origins. Copy the bundled readiness and flag scripts and their [MIT notice](LICENSE) unchanged to the output `scripts` directory. Include a data-free twelve-case Vally suite with one expectation per quest; keep lint static and live model execution unavailable. Do not stage generated or historical material in a model evaluation.
4. Open the actual offline frontend without a network, backend or container. Have a human or a non-model local tool capture its interface for the generated guide (never the public README); report the observation without sending pixels or records to a model. Finish the origin inventory for all data-bearing artifacts and derivatives. Run structural readiness and static lint locally where available. If offline operation cannot be demonstrated, report the incomplete output and blocker; do not replace existing work or claim success.

## Handoff

Give the local location, offline launch instruction, quest 01 entry, observed results and limitations. Identify the origin inventory as local and **not cleared for distribution**. Report structural checks, observed frontend behavior, Vally lint, model use, native HVE execution, optional runtime and learner evidence separately. A clue or a successful checker proves neither learning nor release eligibility.

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
