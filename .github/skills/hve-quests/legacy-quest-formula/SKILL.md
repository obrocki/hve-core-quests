---
name: legacy-quest-formula
description: 'Generate an offline-first, fictional airline legacy application and twelve HVE Core learning quests. Use when creating a Windows 95-style legacy modernization playground.'
argument-hint: 'system-name=<required> [airline-name=<name>] [airline-code=<three letters>] [output=<empty directory>]'
license: MIT
user-invocable: true
metadata:
  authors: "HVE Core Quests contributors"
  spec_version: "1.0"
  last_updated: "2026-11-13"
---

# Legacy Quest Formula

## Goal

Create a playable synthetic airline-reservations system and twelve progressively connected HVE Core quests, beginning with Documentation. A committed EagleDesk 95 instance is the reference; this is a training system, not an airline service.

## Inputs

`system-name` is required. Ask for it if absent. `airline-name` defaults to High Velocity Eagle Airlines; `airline-code` defaults to HVE. The output must be a new or empty directory. Names must not be blank and may contain letters, numbers, spaces, dots, underscores and hyphens; the code is exactly three uppercase letters. Generation and checks require PowerShell 7, Node.js 22.14 or newer and npm; custom screenshot capture requires Playwright Chromium. Read `references/domain-pack.md` for the domain and optional alternatives.

## Flow

1. Confirm the system name and output directory; do not overwrite existing work. Read `references/strata-notes.md` and `references/quest-design.md`.
2. Run `scripts/New-QuestInstance.ps1` with those inputs. The script copies `templates/instance/` and substitutes the three tokens. It regenerates the screenshot for a non-reference name, requiring installed Playwright and a browser.
3. Run `scripts/Test-QuestReadiness.ps1` against the generated directory. Run `npm run eval:lint` after installing the declared dependencies. Follow its README to open the local frontend. Record actual results, skipped checks and reasons.
4. Hand off the generated directory, start instructions and quest 1. Explain that clue verification and eval lint check preconditions and structure, not completion of the quests.

## Success Criteria

Generation completes without overwriting existing files; title, splash, README and screenshot use the supplied name; all 12 quest briefs and clue markers exist; flag hashes match; offline UI works; and the readiness checks pass. Report runtime and evaluation checks separately. Preserve the deliberate training flaws and identify the system as unsafe for production.

## Constraints

Only open-source runtime components. The 1997 sources are inert historical artifacts, never a service. Synthetic data only; no real credentials or passenger data. Never present the random fare stub as trained AI. Use `.copilot-tracking/` for working evidence, not generated secrets.

## Stop Rules

Stop if the required name is missing, the target is not empty, generation fails, or a required verification cannot run. State the exact blocker rather than claiming success. Do not deploy the intentionally vulnerable demo to a public network.

## Handoff and Final Response

Give the output location, invocation, quest 1 entry point, evidence for each check and any unavailable checks. Do not claim model evaluation or connected runtime execution without observing it.

## References

Read `references/lore-and-personas.md`, `references/clue-trail.md`, and `references/hve-core-map.md` when adapting the exercise. `SECURITY.md` describes script boundaries.
