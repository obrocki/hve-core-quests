# Generated-output layout

Use these stable paths regardless of the supplied display names. Generated quest directory slugs and artifact contents may vary, but keep the numeric prefixes and checker-facing filenames unchanged.

| Path | Contract |
|---|---|
| `README.md` | Identify the new system, explain the local offline launch and link to quest 01. Use ordinary relative Markdown links for local navigation. |
| `app/web/index.html` | Offline-capable frontend entry point; it must work locally without a backend, container, or network. |
| `docs/images/eagledesk.png` | A capture of this new frontend, kept only in this local output. The filename is a compatibility convention, not a reference image to find or copy. |
| `docs/workshop-data.json` | Local origin inventory. Record actual methods as the material is created, including data-bearing text, UI records, graphics and captures. See the version 1 contract below. |
| `quests/01-<slug>/README.md` through `quests/12-<slug>/README.md` | Twelve ordered quest briefs, each with a README and a two-digit numeric prefix. |
| `quests/clues.json` | JSON array of twelve entries with integer `quest` values 1–12, an output-root-relative `file` path, and a unique `marker` string. |
| `quests/flags.sha256` | Exactly twelve lines, each `<two-digit quest number> <lowercase SHA-256>`. Hash the UTF-8 bytes of the lower-kebab clue value following the marker, not the marker text. |
| `scripts/Test-QuestReadiness.ps1` | Copy the [bundled checker](../scripts/Test-QuestReadiness.ps1) unchanged. Run it with `-OutputPath` set to the generated root. |
| `scripts/Test-QuestFlag.ps1` | Copy the [bundled flag checker](../scripts/Test-QuestFlag.ps1) unchanged. It checks discovery only. |
| `scripts/LICENSE` | Copy the [formula's MIT notice](../LICENSE) with the two scripts, including when the skill directory is installed on its own. |
| `evals/eagledesk-quests/eval.yaml` | One procedural stimulus named `quest-01-...` through `quest-12-...`, each with an expectation. Do not include or stage example content. |
| `package.json` | Declare the Vally dependency and local readiness and static suite-lint commands. Do not expose a live evaluation command. Dependencies are not required for frontend launch. |

## Local origin inventory: version 1

Write a single JSON object with **exactly** these fields. Use the indicated JSON types and case. It records origin, not evidence of permission.

| Field | Required value or meaning |
|---|---|
| `schemaVersion` | Integer `1`. |
| `purpose` | `"workshop"`: teaching people, not training a model. |
| `inputMode` | `"unseeded"`: no source content used as an example. |
| `intendedAudience` | `"local"`. |
| `distributionStatus` | `"not-cleared"`. |
| `artifacts` | Nonempty array; each object has exactly `scope`, `method` and `modelChannelCategory`. |

`scope` is an existing file or directory **inside the output**, relative to its root, using `/` between path components consisting of ASCII letters, digits, dots, hyphens or underscores. Use a meaningful scope, not the root, the inventory itself, an absolute path, a URL, a glob, a link/junction, or a `.`/`..` component. Choose non-identifying file names. Group artifacts only when their origins agree; record distinct contributions separately when a derivative has mixed origins.

`method` is `"model"`, `"manual"` (human-authored), or `"deterministic"` (produced by a repeatable non-model process). For `"model"`, `modelChannelCategory` is a non-secret category: `"organization-managed"`, `"third-party-managed"` or `"on-device"`. For either other method it must be JSON `null`, not a string or an omitted field. Record a capture's actual method and also account for what it depicts; a deterministic capture does not make underlying model-written material deterministic.

Do not store raw prompts, source data, names of people, credentials, identifiers for approval cases, endpoint addresses or internal URLs. Do not infer an unknown origin, invent a category to pass, or backfill an older instance. Missing or malformed provenance means governance readiness is not met: origin unknown. Even a structurally complete record is not authorization for model use, reuse or release.

## Discovery checks

The manifest is a JSON array with exactly one entry for each quest number 1–12; each entry has an output-root-relative `file` path and a unique `marker` string. Each clue source contains exactly one line matching `<marker>: <lower-kebab-value>`, where the value contains only lowercase ASCII letters, digits, or hyphens. Keep each clue file within the output directory. The corresponding flag row hashes only that value as UTF-8 and uses the quest's two-digit number; each row has exactly one space between the number and 64 lowercase hexadecimal characters. Do not expose real credentials or passenger data in clues.

The checker covers required files, local inline link targets in the root and quest READMEs, screenshot presence, provenance structure, and clue/suite structure. It does not inspect screenshot pixels or contact link targets. Open and observe the frontend offline separately. Neither the structural checker nor suite lint establishes release eligibility, native HVE execution or learner competency.
