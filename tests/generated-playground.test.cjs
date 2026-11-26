'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { parse } = require('yaml');
const { checkComposition, compositionChecks, questIds } = require('../evals/generated-playground/composition.cjs');
const { checkBehavior, outcomes } = require('../evals/generated-playground/behavior.cjs');

const repo = path.resolve(__dirname, '..');
const suite = path.join(repo, 'evals', 'generated-playground');
const checker = path.join(suite, 'program.cjs');
const spec = name => parse(fs.readFileSync(path.join(suite, `${name}.eval.yaml`), 'utf8'));
const digest = value => createHash('sha256').update(value).digest('hex');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/0ioAAAAASUVORK5CYII=', 'base64');

function temp(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'hve-author-probe-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (rel, content) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === 'string' || Buffer.isBuffer(content) ? content : JSON.stringify(content));
  };
  return { root, write };
}

const page = '<!doctype html><html><body><main></main>' +
  '<script src="../store/a.js"></script><script src="../logic/b.js"></script><script src="c.js"></script></body></html>';

function frontend(write) {
  write('app/web/index.html', page);
  write('app/store/a.js', 'window.ProbeValues = [1];\n');
  write('app/logic/b.js', 'window.ProbeLogic = { count: () => ProbeValues.length };\n');
  write('app/web/c.js', "document.querySelector('main').textContent = String(ProbeLogic.count());\n");
}

function structure(write) {
  frontend(write);
  const clues = questIds.map(quest => ({
    quest: Number(quest), file: `quests/${quest}-probe/README.md`, marker: `marker-${quest}`
  }));
  write('README.md', '[Begin](quests/01-probe/README.md)\n');
  for (const { quest, file, marker } of clues) write(file, `[Home](../../README.md)\n${marker}: probe-${quest}\n`);
  write('quests/clues.json', clues);
  write('quests/flags.sha256', questIds.map((id, index) =>
    `${id} ${digest(`probe-${index + 1}`)}`).join('\n') + '\n');
  write('docs/workshop-data.json', {
    schemaVersion: 1, purpose: 'workshop', inputMode: 'unseeded', intendedAudience: 'local',
    distributionStatus: 'not-cleared',
    artifacts: ['README.md', 'app', 'docs/images', 'quests']
      .map(scope => ({ scope, method: 'deterministic', modelChannelCategory: null }))
  });
  write('docs/images/eagledesk.png', png);
  write('.github/instructions/probe.instructions.md', '---\napplyTo: "quests/**"\n---\nUse local checks.\n');
  const version = '0.20.0';
  const devDependencies = { '@microsoft/vally-cli': version };
  write('package.json', { devDependencies });
  write('package-lock.json', {
    lockfileVersion: 3,
    packages: {
      '': { devDependencies },
      'node_modules/@microsoft/vally-cli': { version, license: 'MIT', integrity: `sha512-${Buffer.alloc(64).toString('base64')}` }
    }
  });
  const pack = path.join(repo, '.github', 'skills', 'legacy-quest-formula');
  for (const asset of ['Test-QuestReadiness.ps1', 'Test-QuestFlag.ps1', 'LICENSE']) {
    write(`scripts/${asset}`, fs.readFileSync(path.join(pack, asset === 'LICENSE' ? asset : `scripts/${asset}`)));
  }
  const evalPath = 'evals/eagledesk-quests/eval.yaml';
  write(evalPath, fs.readFileSync(path.join(repo, evalPath)));
  return clues;
}

test('Vally MockExecutor and all composition graders leave an unconfigured browser unresolved', async t => {
  const output = temp(t);
  const workspace = temp(t);
  const { MockExecutor } = await import('@microsoft/vally/executor/mock');
  const { gradeTrajectory, loadEvalSpec } = await import('@microsoft/vally');
  const executor = new MockExecutor();
  const composition = await loadEvalSpec(path.join(suite, 'composition.eval.yaml'));
  structure(output.write);
  const seen = [];
  for (const stimulus of composition.stimuli) {
    const trajectory = await executor.execute(stimulus, { workDir: workspace.root, skills: [] });
    assert.equal(trajectory.metadata.executor, 'mock');
    const [grader] = stimulus.graders;
    const evaluation = await gradeTrajectory(trajectory, [withAuthorPath(grader, {
      HVE_QUEST_PLAYGROUND: output.root, HVE_QUEST_CHROMIUM: ''
    })], { stimulus });
    const detail = evaluation.details[0];
    seen.push([detail.metadata?.check, detail.metadata?.status, detail.evidence]);
  }
  assert.deepEqual(seen.map(([check, status]) => [check, status]), compositionChecks.map(check =>
    [check, check === 'offline-startup' ? 'not-testable' : 'pass']), JSON.stringify(seen));
  assert.equal((await checkComposition(undefined, 'readiness')).status, 'not-testable');
  assert.equal((await checkComposition(repo, 'readiness')).status, 'fail');
});

test('capture, brief and generated spec checks reject independent missing evidence', async t => {
  const { root, write } = temp(t);
  structure(write);
  write('docs/images/eagledesk.png', png.subarray(0, -12));
  assert.match((await checkComposition(root, 'capture-container')).evidence, /final IEND|truncated/);
  write('quests/07-probe/README.md', '\n');
  assert.match((await checkComposition(root, 'quest-briefs')).evidence, /07.*nonempty brief/);
  const procedural = 'evals/eagledesk-quests/eval.yaml';
  const original = fs.readFileSync(path.join(repo, procedural), 'utf8');
  write(procedural, `${original}\nagent_environment: {}\n`);
  assert.match((await checkComposition(root, 'procedural-suite')).evidence, /fixture setup/);
});

test('composition rejects disconnected sources and nonlocal and out-of-output frontend assets', async t => {
  const { root, write } = temp(t);
  frontend(write);
  assert.equal((await checkComposition(root, 'tier-wiring')).status, 'pass');
  write('app/logic/b.js', 'window.ProbeLogic = { count: () => 0 };\n');
  assert.match((await checkComposition(root, 'tier-wiring')).evidence, /No static chain/);
  frontend(write);
  write('app/web/index.html', page.replace('<main>', '<img src="https://example.invalid/no.png"><main>'));
  assert.match((await checkComposition(root, 'tier-wiring')).evidence, /remote/);
  write('app/web/index.html', page.replace('src="c.js"', 'src="../../../outside.js"'));
  assert.match((await checkComposition(root, 'tier-wiring')).evidence, /outside the output/);
  write('app/web/index.html', page.replace('src="c.js"', 'src="node_modules/c.js"'));
  write('app/web/node_modules/c.js', 'ProbeLogic.count();');
  assert.match((await checkComposition(root, 'tier-wiring')).evidence, /installed tooling/);
});

test('composition distinguishes wrong evidence from incomplete licensing and provenance evidence', async t => {
  const { root, write } = temp(t);
  const clues = structure(write);
  write('scripts/Test-QuestFlag.ps1', 'This copy was changed.');
  assert.equal((await checkComposition(root, 'pack-integrity')).status, 'fail');
  write('app/extra.md', 'An existing scope already covers this document.');
  assert.equal((await checkComposition(root, 'unseeded-inventory')).status, 'pass');
  write('docs/extra.md', 'No declared directory scope covers this document.');
  assert.match((await checkComposition(root, 'unseeded-inventory')).evidence, /missing from the inventory/);
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'workshop-data.json'), 'utf8'));
  inventory.artifacts[0].modelChannelCategory = 'organization-managed';
  write('docs/workshop-data.json', inventory);
  assert.match((await checkComposition(root, 'unseeded-inventory')).evidence, /inconsistent method/);
  write('app/service/probe.csproj', '<Project />');
  assert.equal((await checkComposition(root, 'dependency-evidence')).status, 'not-testable');
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  lock.packages[''].dependencies = { other: 'anything' };
  write('package-lock.json', lock);
  assert.match((await checkComposition(root, 'dependency-evidence')).evidence, /root inventory disagree/);
  delete lock.packages[''].dependencies;
  lock.packages['node_modules/@microsoft/vally-cli'].license = 'UNLICENSED';
  write('package-lock.json', lock);
  assert.equal((await checkComposition(root, 'dependency-evidence')).status, 'fail');
  clues[1].marker = clues[0].marker;
  write('quests/clues.json', clues);
  assert.match((await checkComposition(root, 'clue-discovery')).evidence, /repeated quest or marker/);
  clues[1].marker = 'marker-02';
  clues[1].quest = '2';
  write('quests/clues.json', clues);
  assert.match((await checkComposition(root, 'clue-discovery')).evidence, /invalid or repeated quest/);
  clues[1].quest = 2;
  write('quests/clues.json', JSON.stringify(clues).replace('"quest":2', '"quest":3,"quest":2'));
  assert.match((await checkComposition(root, 'clue-discovery')).evidence, /duplicate or ambiguous JSON/);
});

test('offline startup observes file rendering and rejects script errors and attempted remote requests', {
  skip: !process.env.HVE_QUEST_TEST_CHROMIUM
}, async t => {
  const { root, write } = temp(t);
  frontend(write);
  const options = { chromium: process.env.HVE_QUEST_TEST_CHROMIUM };
  const startup = await checkComposition(root, 'offline-startup', options);
  assert.equal(startup.status, 'pass', startup.evidence);
  write('app/web/c.js', 'ProbeLogic.count(); throw new Error("Startup probe");\n');
  assert.equal((await checkComposition(root, 'offline-startup', options)).status, 'fail');
  write('app/web/c.js', `document.querySelector('main').textContent = String(ProbeLogic.count());
const image = document.createElement('img');
document.querySelector('main').append(image);
image.src = 'https://example.invalid/startup-probe.png';\n`);
  assert.equal((await checkComposition(root, 'offline-startup', options)).status, 'fail');
});

function walkthrough(write, id) {
  const references = { application: 'app/logic/b.js', data: 'app/store/a.js' };
  const deliverable = 'A data-free artifact for testing the checker.';
  const observation = 'Local probe metadata only.';
  const reported = { status: 'reported', references: [{ path: '.hve-walkthrough/probe.log', sha256: digest(observation) }] };
  const receipt = {
    schemaVersion: 1,
    quest: Number(id),
    previousQuest: id === '01' ? null : Number(id) - 1,
    artifact: 'ready',
    artifactSha256: digest(deliverable),
    gates: {
      native: { status: 'not-run', references: [] },
      human: { status: 'blocked', references: [] },
      runtime: { status: 'not-run', references: [] }
    },
    limits: ['The statements here exercise receipt structure only.'],
    outcomes: Object.fromEntries(outcomes[id].map(key => [key, {
      finding: 'A finding with an output-local reference.',
      sources: [{ path: references[key] ?? 'app/web/index.html', line: 1 }]
    }]))
  };
  if (id === '07') {
    receipt.gates.runtime = reported;
    receipt.runs = {
      conflict: { command: 'local probe', exit: 0, detected: true },
      control: { command: 'local probe', exit: 0, detected: false }
    };
  }
  if (id === '12') {
    receipt.gates.runtime = reported;
    receipt.runs = {
      red: { command: 'local target', exit: 1 },
      green: { command: 'local target', exit: 0 },
      regression: { command: 'local baseline', exit: 0 }
    };
  }
  write(`.hve-walkthrough/${id}.md`, deliverable);
  write(`.hve-walkthrough/${id}.json`, receipt);
  if (receipt.gates.runtime === reported) write('.hve-walkthrough/probe.log', observation);
  return receipt;
}

test('all twelve artifact graders reject missing or incomplete evidence without promoting reported gates', t => {
  const { root, write } = temp(t);
  frontend(write);
  for (const id of questIds) {
    assert.equal(checkBehavior(root, id).status, 'fail', id);
    const receipt = walkthrough(write, id);
    const result = checkBehavior(root, id);
    assert.equal(result.status, 'pass', `${id}: ${result.evidence}`);
    for (const gate of ['native', 'human', 'runtime']) assert.equal(result[gate], 'not-testable', id);
    assert.equal(result.semantic, 'uncalibrated');
    delete receipt.outcomes[outcomes[id][0]];
    write(`.hve-walkthrough/${id}.json`, receipt);
    assert.equal(checkBehavior(root, id).status, 'fail', id);
  }
});

test('behavioral graders reject self-citations, fake controls and a changed red/green command', t => {
  const { root, write } = temp(t);
  frontend(write);
  const receipts = Object.fromEntries(questIds.map(quest => [quest, walkthrough(write, quest)]));
  const trace = receipts['02'];
  trace.outcomes.data.sources = [{ path: '.hve-walkthrough/02.md', line: 1 }];
  write('.hve-walkthrough/02.json', trace);
  assert.match(checkBehavior(root, '02').evidence, /references itself/);
  const reproduction = receipts['07'];
  const saved = reproduction.gates.runtime;
  write('.hve-walkthrough/probe.log', 'Changed local probe metadata.');
  assert.match(checkBehavior(root, '07').evidence, /stale digest/);
  write('.hve-walkthrough/probe.log', 'Local probe metadata only.');
  reproduction.gates.runtime = { status: 'blocked', references: [] };
  write('.hve-walkthrough/07.json', reproduction);
  assert.equal(checkBehavior(root, '07').status, 'not-testable');
  reproduction.gates.runtime = saved;
  reproduction.runs.control.detected = true;
  write('.hve-walkthrough/07.json', reproduction);
  assert.match(checkBehavior(root, '07').evidence, /do not discriminate/);
  const delivery = receipts['12'];
  delivery.runs.red.command = 'unrelated command';
  write('.hve-walkthrough/12.json', delivery);
  assert.match(checkBehavior(root, '12').evidence, /one test command/);
});

test('walkthrough artifacts are bound to their receipts, predecessor and cited local evidence', t => {
  const { root, write } = temp(t);
  frontend(write);
  const second = walkthrough(write, '02');
  assert.equal(checkBehavior(root, '02').status, 'fail');
  const first = walkthrough(write, '01');
  assert.equal(checkBehavior(root, '02').status, 'pass');
  second.previousQuest = '1';
  write('.hve-walkthrough/02.json', second);
  assert.match(checkBehavior(root, '02').evidence, /prescribed quest and prerequisite/);
  second.previousQuest = 1;
  write('.hve-walkthrough/02.json', second);
  write('.hve-walkthrough/01.md', 'The artifact has changed after its receipt.');
  assert.match(checkBehavior(root, '02').evidence, /stale digest/);
  first.gates.native = { status: 'reported', references: [] };
  write('.hve-walkthrough/01.json', first);
  assert.match(checkBehavior(root, '01').evidence, /observation without/);
});

function withAuthorPath(grader, env = {}) {
  return { ...grader, config: { ...grader.config, env: { HVE_QUEST_AUTHOR_CHECKER: checker, ...env } } };
}

function additions(id, ending = '\n') {
  return ['md', 'json'].map(ext => `--- /dev/null${ending}+++ b/.hve-walkthrough/${id}.${ext}${ending}`).join('');
}

test('installed Vally diff graders accept creation headers, not echo, denial or wrong-turn evidence', async () => {
  const { createDefaultGraderRegistry, gradeTrajectory } = await import('@microsoft/vally');
  const stimulus = spec('behavioral').stimuli[0];
  const grader = createDefaultGraderRegistry().get('diff-contains');
  for (const [index, id] of questIds.entries()) {
    const { config, turn } = stimulus.graders.find(candidate => candidate.name === `generated-quest-${id}-turn-creation`);
    assert.equal(turn, index);
    const previous = questIds[(index + 11) % 12];
    const [markdown, receipt] = additions(id).trimEnd().split(/(?=^---)/m);
    const check = async diff => (await grader.grade({ trajectory: { diff }, config })).passed;
    assert.equal(await check(additions(id)), true, id);
    assert.equal(await check(receipt + '\n' + markdown.replaceAll('\n', '\r\n')), true, id);
    assert.equal(await check(additions(previous)), false, id);
    assert.equal(await check(additions(id).replaceAll('/dev/null', `a/.hve-walkthrough/${id}.json`)), false, id);
    assert.equal(await check(markdown), false, id);
    assert.equal(await check(stimulus.turns[index]), false, id);
    assert.equal(await check('The required workspace is unavailable.'), false, id);
  }
  const appGrade = stimulus.graders.at(-1);
  const checkChange = async diff => (await grader.grade({ trajectory: { diff }, config: appGrade.config })).passed;
  assert.equal(await checkChange('--- a/app/web/c.js\n+++ b/app/web/c.js\n'), true);
  assert.equal(await checkChange(additions('12')), false);
  assert.equal(await checkChange('--- a/app/web/c.js\n+++ /dev/null\n'), false);

  const graders = stimulus.graders.filter(candidate => candidate.type === 'diff-contains');
  const turnDiffs = questIds.map((id, turn) => ({ turn, diff: additions(id) }));
  turnDiffs.at(-1).diff += '--- a/app/web/c.js\n+++ b/app/web/c.js\n';
  const trajectory = {
    id: 'offline-order-probe', stimulus, events: [], output: '',
    turnDiffs, diff: turnDiffs.map(record => record.diff).join('')
  };
  const score = () => gradeTrajectory(trajectory, graders, { stimulus });
  const correct = await score();
  assert.equal(correct.passed, true, correct.evidence);
  [turnDiffs[0].diff, turnDiffs[1].diff] = [turnDiffs[1].diff, turnDiffs[0].diff];
  const wrongOrder = await score();
  assert.equal(wrongOrder.passed, false);
  assert.deepEqual(wrongOrder.details.filter(detail => !detail.passed).map(detail => detail.configuredName),
    ['generated-quest-01-turn-creation', 'generated-quest-02-turn-creation']);
  trajectory.turnDiffs = undefined;
  const cumulativeOnly = await score();
  assert.equal(cumulativeOnly.passed, false);
  assert.equal(cumulativeOnly.status, 'error');
});

test('Vally program adapters grade external local evidence and fail closed without it', async t => {
  const { root, write } = temp(t);
  const { createDefaultGraderRegistry } = await import('@microsoft/vally');
  const grader = createDefaultGraderRegistry().get('program');
  frontend(write);
  const grade = (candidate, env) => grader.grade({
    trajectory: { workDir: root },
    config: withAuthorPath(candidate, env).config
  });
  const behavior = spec('behavioral').stimuli[0].graders[0];
  const absent = await grade(behavior);
  assert.equal(absent.passed, false, absent.evidence);
  walkthrough(write, '01');
  const local = await grade(behavior);
  assert.equal(local.passed, true, local.evidence);
  assert.equal(local.metadata.native, 'not-testable');
  const composition = spec('composition').stimuli.find(stimulus => stimulus.name === 'generated-three-tier-wiring').graders[0];
  const blocked = await grade(composition, { HVE_QUEST_PLAYGROUND: '' });
  assert.equal(blocked.passed, false);
  assert.equal(blocked.metadata.status, 'not-testable');
  const checked = await grade(composition, { HVE_QUEST_PLAYGROUND: root });
  assert.equal(checked.passed, true, checked.evidence);
});

test('the full Vally behavioral grade accepts ordered synthetic evidence, but not a mock echo', async t => {
  const { root, write } = temp(t);
  const { MockExecutor } = await import('@microsoft/vally/executor/mock');
  const { gradeTrajectory, loadEvalSpec } = await import('@microsoft/vally');
  const { stimuli: [stimulus] } = await loadEvalSpec(path.join(suite, 'behavioral.eval.yaml'));
  const graders = stimulus.graders.map(grader => grader.type === 'program' ? withAuthorPath(grader) : grader);
  const trajectory = await new MockExecutor().execute(stimulus, { workDir: root, skills: [] });
  const score = () => gradeTrajectory(trajectory, graders, { stimulus });
  const echo = await score();
  assert.equal(echo.passed, false);
  assert.equal(echo.details.filter(detail => detail.passed).length, 0);
  assert.equal(trajectory.metadata.executor, 'mock');

  frontend(write);
  for (const quest of questIds) walkthrough(write, quest);
  // The built-in mock executor does not observe stable turn completion or capture patches.
  trajectory.turnDiffs = questIds.map((id, turn) => ({ turn, diff: additions(id) }));
  trajectory.turnDiffs.at(-1).diff += '--- a/app/web/c.js\n+++ b/app/web/c.js\n';
  const grade = await score();
  assert.equal(grade.passed, true, `${grade.evidence}: ${grade.details.filter(detail => !detail.passed).map(d => d.evidence)}`);
  assert.equal(grade.details.filter(detail => detail.passed).length, 25);
  assert.equal(grade.details.filter(detail => detail.graderType === 'program').every(detail =>
    detail.metadata.native === 'not-testable' && detail.metadata.semantic === 'uncalibrated'), true);
});

test('suite specs contain no staged material and dedupe all prompt and turn text by normalized SHA-256', () => {
  const old = parse(fs.readFileSync(path.join(repo, 'evals', 'eagledesk-quests', 'eval.yaml'), 'utf8'));
  const composition = spec('composition');
  const behavior = spec('behavioral');
  assert.deepEqual(composition.stimuli.map(stimulus => stimulus.graders[0].config.args.at(-1)), compositionChecks);
  assert.deepEqual(behavior.stimuli[0].turns.map(turn => /^Quest (\d\d),/.exec(turn)?.[1]), questIds);
  for (const definition of [composition, behavior]) {
    assert.deepEqual(definition.defaults, { executor: 'mock', runs: 1 });
    for (const stimulus of definition.stimuli) {
      assert.deepEqual(stimulus.supported_executors, ['mock']);
      assert.ok(stimulus.graders.every(grader => ['program', 'diff-contains'].includes(grader.type)));
    }
  }
  const names = new Set();
  const hashes = new Set();
  for (const definition of [old, composition, behavior]) {
    assert.doesNotMatch(JSON.stringify(definition),
      /"(?:agent_environment|environment|grading_environment|attachments|golden_[^"]+|simulation)"\s*:/);
    for (const stimulus of definition.stimuli) {
      for (const prompt of stimulus.turns ?? [stimulus.prompt]) {
        const hash = digest(prompt.normalize('NFC').trim().toLowerCase().replace(/\s+/gu, ' '));
        assert.ok(!hashes.has(hash), `Duplicate normalized prompt digest: ${hash}`);
        hashes.add(hash);
      }
      for (const grader of stimulus.graders) {
        assert.ok(grader.name && !names.has(grader.name), `Duplicate or missing grader name: ${grader.name}`);
        names.add(grader.name);
      }
    }
  }
  assert.equal(hashes.size, 34);
});
