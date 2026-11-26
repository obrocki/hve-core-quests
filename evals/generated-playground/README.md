# Generated playground author checks

These checks are outside the four-file customer pack. The specs contain procedures and evidence contracts, not playground files or examples. They do not enable the disabled live-evaluation entry, establish model eligibility, or grant a separate use of workshop material.

## Offline composition

Use Node.js 22.14+, the repository's locked dev tools, and PowerShell 7. Only inspect a separately created local output that is already eligible for local review. No generated npm scripts are executed.

```powershell
npm ci
npm run eval:lint
npm run eval:composition -- 'C:\path\to\eligible-local-output'
```

`HVE_QUEST_PLAYGROUND` can supply the same absolute path. Each of the [ten composition cases](composition.eval.yaml) reports its own `pass`, `fail`, `not-testable`, or `error` status. Exit `0` means all passed, `1` means evidence failed, and `2` means at least one result is unavailable or a checker could not run. An unresolved case is never a pass.

The checks cover packaged readiness, exact checker and license copies, all twelve nonempty quest briefs, PNG chunk framing and checksums, the unstaged procedural eval, a connected local three-source path, offline startup, locked license evidence, all twelve clue/flag checks plus a negative control, and declared origin-scope coverage. The resource check traces relative imports and common classic-script global references; it is not a complete JavaScript or network audit. The license check recognizes common open license declarations in resolved npm lock entries; unsupported ecosystems, missing declarations and vendored assets need independent review. The inventory check cannot verify content origin, eligibility or distribution rights. PNG container evidence does not verify the actual screenshot.

For the browser case only, set `HVE_QUEST_CHROMIUM` to an absolute path to a trusted local Chromium-compatible executable. Use a disposable, network-isolated environment to open the program. A fresh offline browser context loads the real `file:` URL, observes visible startup and loaded local scripts, and checks that Tab reaches a visible focus target without observed page, console or request errors. It does not exercise lookup, holds, expiry or conflict controls or establish accessibility conformance. Without the browser the case is explicitly `not-testable`.

## Walkthrough contract

The [behavioral spec](behavioral.eval.yaml) defines one continuous 12-turn walkthrough, starting with Documentation. The formula supplies no path to stage generated material in a model evaluation. The spec only allows the mock executor and configures no model. A model selector would not verify the effective provider, route or fallback.

Each quest has turn-scoped diff checks for newly written Markdown and JSON and for protected inputs remaining unchanged, plus a check on the artifact digest, predecessor and cited line locations. Only Quest 12 may change application source, and it must do so in its own turn. Quest 07 and Quest 12 require distinguishable control and regression records, respectively. Gate claims must refer to a nonempty local file with a matching digest. A digest detects stale file references, not fabrication. These are checks on observable files and structured claims, not proof that a reported command, approval or HVE tool invocation happened. Native invocation, human decisions and runtime observation each remain `not-testable` by the artifact grader; semantic quality remains `uncalibrated`.

To inspect already collected local receipts without a Vally executor, use the same absolute path (or `HVE_QUEST_PLAYGROUND`) with `npm run eval:evidence -- 'C:\path\to\eligible-local-output'`. This reads `.hve-walkthrough/01.md` and `01.json` through `12.md` and `12.json`, never runs commands from receipts, and cannot verify turn chronology.

The Vally program graders resolve the trusted author checker from the absolute `HVE_QUEST_AUTHOR_CHECKER` path to `program.cjs` in the separate author checkout. Composition reads `HVE_QUEST_PLAYGROUND`; behavior reads the Vally-provided workspace. Nothing is mounted by these specs. Turn-scoped assertions require captured per-turn diffs from a disposable workspace; a final diff or a plausible response is not equivalent.

`npm test` (or `npm run test:generated` for just this suite) uses temporary, data-free positive and negative evidence. The installed Vally `MockExecutor` runs without a model but does not provide turn-completion callbacks. The behavioral test supplies stable callbacks for local test writes, so Vally captures and grades the actual resulting Git diffs; the stock mock CLI is not a substitute for this test. A passing mock proves only the grader and fixture contract. A planner probe confirms that a non-mock selection is skipped before backend or executor work. Set `HVE_QUEST_TEST_CHROMIUM` to a local browser executable to also test offline startup on a disposable static page.

`npm run eval:lint` names all three specs separately because Vally 0.20.0 directory discovery misses the canonical `.eval.yaml` filenames and its lint command accepts only the last `--eval-spec`. Run the installed HVE Core `vally-tests` `Lint-VallyTestSafety.ps1` against both canonical specs when changing stimuli. The probes also check NFC normalization and SHA-256 dedupe across all specs.

## Requested family profiles

The [HVE coverage matrix and operator runbook](hve-live-lane.md) map the twelve quests to HVE Core 3.2.2 and document the separate offline native-trace grader. No live executor is enabled.

This is assignment metadata, not executable provider configuration, an effective routing record, or authorization. The same local tooling applies to every family.

| Family | Requested generation profile | Requested test profile |
|---|---|---|
| Google | `gemini-4-neon`, `xhigh` (highest offered), `long_context` | `gemini-4-carbon`, medium |
| Anthropic | `claude-opus-5.5`, max, `long_context` | `claude-sonnet-5.5`, medium |
| OpenAI | `gpt-6.2-sol`, max, `long_context` | `gpt-6.1-terra`, medium |
| Microsoft | `mai-code-2`, max, default context (no long selector offered) | `mai-code-2-flash`, medium |
| Copilot Fusion | Auto (`hydrafusion-max` requested); effective model, tier and context not exposed | Auto Balance, medium requested; exact tier ID and route unverified |

No playground was generated and no live quest ran under any profile. Vally's model, reasoning-effort and executor selectors do not establish actual provider, fallback, entitlement or context size. Do not substitute a different route or interpret mock results as live scores.
