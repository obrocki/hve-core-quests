'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parse } = require('yaml');
const test = require('node:test');
const { outcomes } = require('../evals/generated-playground/behavior.cjs');
const { plugin, profile, steps } = require('../evals/generated-playground/hve-steps.cjs');
const { checkNative } = require('../evals/generated-playground/hve-trace.cjs');
const { sha256 } = require('../evals/generated-playground/local-files.cjs');

const suite = path.resolve(__dirname, '..', 'evals', 'generated-playground');
const lane = path.join(suite, 'live-lane.cjs');
const program = path.join(suite, 'program.cjs');
const providers = ['google', 'anthropic', 'openai', 'microsoft', 'fusion'];
const attested = ['--provider', 'openai', '--attested-provider', 'openai'];

function invoke(args) {
  const result = spawnSync(process.execPath, [lane, ...args], { encoding: 'utf8', windowsHide: true });
  assert.ifError(result.error);
  assert.equal(result.stderr, '');
  return { exit: result.status, record: JSON.parse(result.stdout), output: result.stdout };
}

function setup(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'hve-lane-probe-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'playground');
  fs.mkdirSync(workspace);
  const trace = path.join(root, 'events.jsonl');
  const events = [];
  const id = i => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  function emit(type, data = {}, envelope = {}) {
    const event = {
      type, id: id(events.length + 1), parentId: events.at(-1)?.id ?? null, timestamp: '2026-01-01T00:00:00.000Z',
      data, ...envelope
    };
    events.push(event);
    return event.id;
  }
  emit('session.start', { sessionId: id(0), context: { cwd: workspace } });
  function turn(marker, actions, { final = true, delivery = 'idle' } = {}) {
    const turnId = String(events.length);
    const user = emit('user.message', { content: marker ? `HVE-QUEST ${marker}\nData-free probe.` : 'Local follow-up.',
      turnId, delivery });
    emit('assistant.turn_start', { turnId });
    actions(turnId);
    if (final) emit('assistant.turn_end', { turnId });
    return user;
  }
  function skill(name, changes = {}, envelope = {}) {
    emit('skill.invoked', { name, path: '', content: 'NOT-AN-INVOCATION-OUTPUT', pluginName: plugin.name,
      pluginVersion: plugin.version, source: 'plugin', trigger: 'agent-invoked', ...changes }, envelope);
  }
  function agent(name, turnId, options = {}) {
    const key = `hve-core:${name}`;
    const toolCallId = `task-${events.length}`;
    const agentId = `agent-${events.length}`;
    emit('tool.execution_start', {
      toolName: 'task', toolCallId, turnId, arguments: { agent_type: key }, ...options.call
    });
    if (options.started !== false) emit('subagent.started',
      { toolCallId, agentName: key, agentDisplayName: 'Probe', agentDescription: 'Probe', ...options.start }, { agentId });
    return agentId;
  }
  function save(location = trace) {
    fs.writeFileSync(location, events.map(event => JSON.stringify(event)).join('\n') + '\n');
    return location;
  }
  function write(relative, data) {
    const file = path.join(workspace, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
  }
  function documentation() {
    const artifact = 'The local probe has a separate operational boundary.';
    write('app/web/index.html', '<main>Data-free probe</main>\n');
    write('.hve-walkthrough/01.md', artifact);
    write('.hve-walkthrough/01.json', {
      schemaVersion: 1, quest: 1, previousQuest: null, artifact: 'ready', artifactSha256: sha256(artifact),
      limits: ['This is test evidence only.'],
      gates: { native: { status: 'reported', references: [{ path: 'app/web/index.html', sha256: sha256('<main>Data-free probe</main>\n') }] },
        human: { status: 'blocked', references: [] }, runtime: { status: 'not-run', references: [] } },
      outcomes: Object.fromEntries(outcomes['01'].map(name => [name,
        { finding: 'A separate local evidence finding.', sources: [{ path: 'app/web/index.html', line: 1 }] }]))
    });
  }
  return { workspace, trace, events, emit, skill, agent, turn, save, documentation };
}

test('provider attestation is exact and cannot enable generation or launch an executor', () => {
  for (const args of [
    ['preflight', '--provider', 'openai'],
    ['preflight', '--provider', 'openai', '--attested-provider', 'google'],
    ['preflight', '--provider', 'unknown', '--attested-provider', 'unknown'],
    ['grade', '--workspace', 'unavailable', '--quest', '01']
  ]) {
    const result = invoke(args);
    assert.deepEqual(result.record, { status: 'blocked', code: 'provider-attestation-required' });
    assert.equal(result.exit, 2);
  }
  assert.equal(invoke(['preflight', ...attested, '--execute']).exit, 2);
  for (const provider of providers) {
    const { exit, record } = invoke(['preflight', '--provider', provider, '--attested-provider', provider]);
    assert.equal(exit, 2);
    assert.equal(record.attestation, 'user-attested');
    assert.equal(record.independentlyVerified, false);
    assert.equal(record.generation, 'blocked');
    assert.equal(record.liveEvaluation, 'blocked');
    assert.equal(record.requested.questAgent.effort, 'medium');
    assert.deepEqual(record.observed, profile(provider).observed);
    assert.ok(Object.values(record.observed).every(setting => Object.values(setting).every(v => v === 'unobserved')));
  }
});

test('an artifact and its self-reported native gate cannot substitute for a trace invocation', t => {
  const fixture = setup(t);
  fixture.documentation();
  const echo = fixture.turn('01', turnId => {
    fixture.emit('assistant.message', { content: 'I invoked documentation. PRIVATE-FIXTURE-SENTINEL' });
    fixture.emit('tool.execution_start', { toolName: 'skill', arguments: { skill: 'documentation' }, toolCallId: 'claim', turnId });
    fixture.emit('tool.execution_complete', { toolCallId: 'claim', success: true });
  });
  const real = fixture.turn('01', () => fixture.skill('documentation'));
  fixture.save();
  const args = ['grade', ...attested, '--quest', '01', '--workspace', fixture.workspace, '--trace', fixture.trace];
  const incomplete = invoke([...args, '--entry', echo]);
  assert.equal(incomplete.exit, 0);
  assert.equal(incomplete.record.independentlyVerified, false);
  assert.equal(incomplete.record.artifact, 'pass');
  assert.equal(incomplete.record.native.status, 'not-run');
  assert.equal(incomplete.record.native.observed, 0);
  assert.equal(incomplete.record.human, 'not-testable');
  assert.equal(incomplete.record.runtime, 'not-testable');
  assert.equal(incomplete.record.semantic, 'uncalibrated');
  assert.doesNotMatch(incomplete.output, /PRIVATE-FIXTURE-SENTINEL|NOT-AN-INVOCATION-OUTPUT|app\/web/);
  const observed = invoke([...args, '--entry', real]);
  assert.equal(observed.record.native.status, 'observed');
  assert.match(observed.record.native.traceSha256, /^[a-f0-9]{64}$/);
  assert.equal(observed.record.human, 'not-testable');
  assert.equal(observed.record.semantic, 'uncalibrated');
});

test('native skills require origin and a complete, correctly labelled root turn', t => {
  const f = setup(t);
  const unavailable = f.turn('01', () => {
    f.skill('documentation', { trigger: 'context-load' });
    f.skill('documentation', { trigger: 'user-invoked' });
    f.skill('documentation', { pluginVersion: '0.0.0' });
    f.skill('documentation', { pluginName: 'other-plugin' });
    f.skill('documentation', { source: 'project' });
    f.skill('documentation', {}, { checkpoint: true });
    f.skill('documentation', {}, { agentId: 'orphan-agent' });
    f.skill(['documentation']);
  });
  const next = f.turn('02', () => f.skill('documentation'));
  const steering = f.turn('01', () => f.skill('documentation'), { delivery: 'steering' });
  const unfinished = f.turn('01', () => f.skill('documentation'), { final: false });
  f.save();
  const grade = (quest, user) => checkNative(f.workspace, quest, f.trace, [user]);
  assert.equal(grade('01', unavailable).observed, 0);
  assert.equal(grade('01', next).code, 'quest-marker-mismatch');
  assert.equal(grade('01', steering).code, 'quest-turn-unbound');
  assert.equal(grade('01', unfinished).code, 'quest-turn-incomplete-or-ambiguous');
  assert.equal(checkNative(f.workspace, '01', f.trace, [unavailable, steering]).code,
    'quest-entries-missing-or-not-contiguous');
});

test('agent evidence joins a native launch to its started child before counting child skills', t => {
  const f = setup(t);
  const unmatched = f.turn('03', turnId => {
    f.agent('dt-coach', turnId, { started: false });
    f.skill('ux-artifacts', {}, { agentId: 'not-dispatched' });
    f.agent('dt-coach', turnId, { start: { toolCallId: 'not-the-launch' } });
    f.agent('dt-coach', turnId, { call: { mcpServerName: 'another-server' } });
    f.agent('dt-coach', turnId, { start: { agentName: 'dt-coach' } });
  });
  const correct = f.turn('03', turnId => {
    const agentId = f.agent('dt-coach', turnId);
    f.skill('ux-artifacts', {}, { agentId });
  });
  const noExperiment = f.turn('11', turnId => f.agent('rai-planner', turnId));
  f.save();
  const grade = (quest, user) => checkNative(f.workspace, quest, f.trace, [user]);
  assert.equal(grade('03', unmatched).status, 'not-run');
  assert.equal(grade('03', unmatched).observed, 0);
  assert.equal(grade('03', correct).observed, 2);
  assert.equal(grade('11', noExperiment).status, 'observed');
  assert.equal(grade('11', noExperiment).conditionalObserved, 0);
});

test('multi-step native evidence preserves order across explicitly bound follow-ups', t => {
  const f = setup(t);
  const earlier = f.turn('12', () => {
    f.skill('rpi-research');
    f.skill('rpi-plan');
  });
  const later = f.turn(null, () => {
    f.skill('rpi-implement');
    f.skill('rpi-review');
  });
  const unordered = f.turn('12', () => {
    for (const skill of ['rpi-research', 'rpi-implement', 'rpi-plan', 'rpi-review']) f.skill(skill);
  });
  f.save();
  const grade = (...entries) => checkNative(f.workspace, '12', f.trace, entries);
  assert.equal(grade(earlier).observed, 2);
  assert.equal(grade(earlier, later).status, 'observed');
  assert.equal(grade(later, earlier).status, 'not-run');
  assert.equal(grade(unordered).status, 'not-run');
});

test('missing, in-workspace, malformed and displaced traces stay not-run', t => {
  const f = setup(t);
  const entry = f.turn('01', () => f.skill('documentation'));
  assert.equal(checkNative(f.workspace, '01', f.trace, [entry]).status, 'not-run');
  const unsafe = f.save(path.join(f.workspace, 'events.jsonl'));
  assert.equal(checkNative(f.workspace, '01', unsafe, [entry]).code, 'trace-must-be-held-outside-playground');
  fs.writeFileSync(f.trace, '{"partial":');
  assert.equal(checkNative(f.workspace, '01', f.trace, [entry]).code, 'trace-jsonl-invalid');
  f.events[0].data.context.cwd = path.dirname(f.workspace);
  f.save();
  assert.equal(checkNative(f.workspace, '01', f.trace, [entry]).code, 'trace-workspace-unbound');
  const empty = invoke(['grade', ...attested, '--quest', '01', '--workspace', f.workspace]);
  assert.equal(empty.exit, 0);
  assert.equal(empty.record.artifact, 'not-run');
  assert.equal(empty.record.native.status, 'not-run');
});

test('one-turn Vally ProgramGrader accepts a recorded invocation but not the mock echo', async t => {
  const f = setup(t);
  const absent = f.turn('01', () => f.emit('assistant.message', { content: 'Activated documentation.' }));
  const present = f.turn('01', () => f.skill('documentation'));
  f.save();
  const { createDefaultGraderRegistry } = await import('@microsoft/vally');
  const { MockExecutor } = await import('@microsoft/vally/executor/mock');
  const stimulus = { name: 'documentation-probe', prompt: 'Activate documentation.' };
  const trajectory = await new MockExecutor().execute(stimulus, { workDir: f.workspace, skills: [] });
  const grader = createDefaultGraderRegistry().get('program');
  const grade = entry => grader.grade({
    trajectory, stimulus, config: {
      program: process.execPath, args: [program, 'grade', 'native', '01'],
      env: { HVE_QUEST_PROVIDER: 'openai', HVE_QUEST_ATTESTED_PROVIDER: 'openai',
        HVE_QUEST_TRACE: f.trace, HVE_QUEST_ENTRIES: entry }
    }
  });
  const accepted = await grade(present);
  assert.equal(accepted.passed, true, accepted.evidence);
  assert.equal(accepted.metadata.native.status, 'observed');
  const rejected = await grade(absent);
  assert.equal(rejected.passed, false);
  assert.equal(rejected.metadata.native.status, 'not-run');
});

test('the coverage matrix and native grader follow the existing Documentation-first quest order', () => {
  const spec = parse(fs.readFileSync(path.join(suite, 'behavioral.eval.yaml'), 'utf8'));
  const ids = spec.stimuli[0].turns.map(turn => /^Quest (\d\d),/.exec(turn)[1]);
  assert.deepEqual(Object.keys(steps).sort(), ids);
  const matrix = fs.readFileSync(path.join(suite, 'hve-live-lane.md'), 'utf8');
  const rows = [...matrix.matchAll(/^\| (\d\d) .*$/gm)];
  assert.deepEqual(rows.map(row => row[1]), ids);
  for (const [row, id] of rows) {
    const [, , , traces] = row.split(' | ');
    const targets = [...traces.matchAll(/`([SA])\(([a-z0-9-]+)\)`/g)]
      .map(([, kind, name]) => `${kind === 'S' ? 'skill' : 'agent'}:${name}`);
    assert.deepEqual(targets, [...steps[id].required, ...(steps[id].conditional ?? [])], `Quest ${id}`);
  }
});
