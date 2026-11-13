# Generated-output layout

Use these stable paths regardless of the supplied display names. Generated quest directory slugs and artifact contents may vary, but keep the numeric prefixes and checker-facing filenames unchanged.

| Path | Contract |
|---|---|
| `README.md` | Identify the generated system, explain the local offline launch, and link to quest 1. |
| `app/web/index.html` | Offline-capable frontend entry point; it must work locally without a backend, container, or network. |
| `docs/images/eagledesk.png` | Screenshot captured from the generated frontend. Keep this filename stable for custom system names. |
| `quests/01-<slug>/README.md` through `quests/12-<slug>/README.md` | Twelve ordered quest briefs, each with a README and a two-digit numeric prefix. |
| `quests/clues.json` | JSON array of twelve entries with integer `quest` values 1–12, an output-root-relative `file` path, and a unique `marker` string. |
| `quests/flags.sha256` | Exactly twelve lines, each `<two-digit quest number> <lowercase SHA-256>`. Hash the UTF-8 bytes of the lower-kebab clue value following the marker, not the marker text. |
| `scripts/Test-QuestReadiness.ps1` | Fast checker for required files, all twelve briefs, local documentation links, screenshot presence, clue manifest/markers/hashes, and one suite stimulus per quest. |
| `scripts/Test-QuestFlag.ps1` | Discovery-only flag verifier accepting the generated output path, quest number, and candidate clue value. |
| `evals/eagledesk-quests/eval.yaml` | One Vally stimulus named `quest-01-...` through `quest-12-...`, each with an expectation, such as a deterministic grader. |
| `package.json` | Declare the Vally dependency and commands for readiness, suite linting, and running this generated suite. Install dependencies in the selected output destination only. |

The manifest is a JSON array with exactly one entry for each quest number 1–12; each entry has an output-root-relative `file` path and a unique `marker` string. Each clue source contains exactly one line matching `<marker>: <lower-kebab-value>`, where the value contains only lowercase ASCII letters, digits, or hyphens. Keep each clue file within the output directory. The corresponding flag row hashes only that value as UTF-8 and uses the quest's two-digit number; each row has exactly one space between the number and 64 lowercase hexadecimal characters. Do not expose real credentials or passenger data in clues.

The readiness checker verifies files, links, screenshot presence, and clue/suite structure. Offline frontend behavior must be opened and observed separately; neither the checker nor Vally probes prove frontend behavior, that HVE Core tools were invoked, or that a learner completed a quest. Report those evidence types separately.
