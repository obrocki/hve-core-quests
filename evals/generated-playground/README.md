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

The checks cover packaged readiness, exact checker and license copies, all twelve nonempty quest briefs, PNG container markers, the unstaged procedural eval, a connected local three-source path, offline startup, locked license evidence, all twelve clue/flag checks, and declared origin-scope coverage. The resource check traces relative imports and common classic-script global references; it is not a complete JavaScript or network audit. The license check recognizes common open license declarations in resolved npm lock entries; unsupported ecosystems, missing declarations and vendored assets need independent review. The inventory check cannot verify content origin, eligibility or distribution rights. PNG container evidence does not verify the actual screenshot.

For the browser case only, set `HVE_QUEST_CHROMIUM` to an absolute path to a trusted local Chromium-compatible executable. Use a disposable, network-isolated environment to open the program. The check uses a fresh offline browser context and a real `file:` URL; it observes visible startup, loaded local scripts, and request and page errors during startup. It does not exercise lookup, holds, expiry or conflict controls, which still require independent local observations. Without the browser the case is explicitly `not-testable`.

## Walkthrough contract

The [behavioral spec](behavioral.eval.yaml) defines one continuous 12-turn walkthrough, starting with Documentation. The formula supplies no path to stage generated material in a model evaluation. The spec only allows the mock executor and configures no model. A model selector would not verify the effective provider, route or fallback.

Each quest has a turn-scoped diff assertion for newly written Markdown and JSON, plus a check on the artifact digest, predecessor and cited line locations. Quest 12 also requires an application change in its own turn. Quest 07 and Quest 12 require distinguishable control and regression records, respectively. Gate claims must refer to a nonempty local file with a matching digest. A digest detects stale file references, not fabrication. These are checks on observable files and structured claims, not proof that a reported command, approval or HVE tool invocation happened. Native invocation, human decisions and runtime observation each remain `not-testable` by the artifact grader; semantic quality remains `uncalibrated`.

To inspect already collected local receipts without a Vally executor, use the same absolute path (or `HVE_QUEST_PLAYGROUND`) with `npm run eval:evidence -- 'C:\path\to\eligible-local-output'`. This reads `.hve-walkthrough/01.md` and `01.json` through `12.md` and `12.json`, never runs commands from receipts, and cannot verify turn chronology.

The Vally program graders resolve the trusted author checker from the absolute `HVE_QUEST_AUTHOR_CHECKER` path to `program.cjs` in the separate author checkout. Composition reads `HVE_QUEST_PLAYGROUND`; behavior reads the Vally-provided workspace. Nothing is mounted by these specs. Turn-scoped assertions require captured per-turn diffs from a disposable workspace; a final diff or a plausible response is not equivalent.

`npm test` (or `npm run test:generated` for just this suite) uses temporary, data-free positive and negative evidence. The installed Vally `MockExecutor` runs without a model; the behavioral probe provides synthetic per-turn diffs because MockExecutor does not capture turn boundaries. A passing mock proves only the grader and fixture contract. Set `HVE_QUEST_TEST_CHROMIUM` to a local browser executable to additionally test offline startup and a script-failure case on a disposable static page.

`npm run eval:lint` names all three specs separately because Vally 0.20.0 directory discovery misses the canonical `.eval.yaml` filenames and its lint command accepts only the last `--eval-spec`. Run the installed HVE Core `vally-tests` `Lint-VallyTestSafety.ps1` against both canonical specs when changing stimuli. The probes also check NFC normalization and SHA-256 dedupe across all specs.
