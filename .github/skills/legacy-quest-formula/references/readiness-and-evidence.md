# Readiness and learner evidence

Use the [output layout and provenance contract](output-layout.md) for every new local instance. Copy the packaged [readiness checker](../scripts/Test-QuestReadiness.ps1) and [flag checker](../scripts/Test-QuestFlag.ps1) into its `scripts` directory; do not generate different validation rules. Run the readiness checker against that instance, not the formula tree. The installed copy checks its own instance. Neither invocation writes or repairs an origin record.

An old playground may contain a checker that predates this contract. To inspect it, use the current repository helper with `-OutputPath`; leave both the old checker and its history untouched.

| Evidence | What it establishes | What it cannot establish |
|---|---|---|
| `docs/workshop-data.json` passes the version 1 checks | A local-only record describes existing output-relative scopes with allowed origin methods and channel categories. | Whether the account is true or complete, sources or services were authorized, or data may be shared. Missing/malformed means governance readiness not met, origin unknown; do not migrate or guess. |
| Readiness and clue checks | Required paths, twelve briefs, local inline link targets, screenshot presence, marker/hash consistency and one Vally stimulus per quest. | Actual screenshot content, offline behavior, learner competency or release approval. |
| Opening the offline frontend | The specific local interaction actually observed, without a network, backend or container. | Correctness of an optional connected stack. |
| Static Vally lint | The declared suite parses and has valid structure. | A model response, provider eligibility, native HVE tool use or an assessment of a learner. |
| Learner artifact or demonstration | Evidence against that quest's objective, reviewed in context. | Blanket completion based on a flag, score or file count. |

Use data-free procedural prompts and expectations in the generated suite, not source files or examples. Existing-fixture evaluation is a separate use requiring its own decision; it is not a fallback for blocked generation or blocked live evaluation. Report skipped model, native-tool and connected-runtime checks as not run, not as successes.
