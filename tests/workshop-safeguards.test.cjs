'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { evaluationBlock } = require('../scripts/eval-preflight.cjs');

const repo = path.resolve(__dirname, '..');
const helpers = path.join(repo, '.github', 'skills', 'legacy-quest-formula', 'scripts');
const suite = 'evals/eagledesk-quests/eval.yaml';
const numbers = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

test('customer pack is self-contained and ships no workbench or example content', () => {
  const pack = path.dirname(helpers);
  const files = fs.readdirSync(pack, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.relative(pack, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')).sort();
  assert.deepEqual(files, ['LICENSE', 'SKILL.md', 'scripts/Test-QuestFlag.ps1', 'scripts/Test-QuestReadiness.ps1']);
  const prompt = fs.readFileSync(path.join(pack, 'SKILL.md'), 'utf8');
  for (const file of [path.join(pack, 'SKILL.md'), path.join(repo, 'README.md')]) {
    const body = fs.readFileSync(file, 'utf8');
    for (const [, target] of body.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^https?:/.test(target)) continue;
      const [relative, anchor] = target.split('#');
      const resolved = relative ? path.resolve(path.dirname(file), relative) : file;
      const boundary = file.endsWith('SKILL.md') ? pack : repo;
      assert.ok(resolved.startsWith(boundary + path.sep) && fs.existsSync(resolved), `Missing local dependency: ${target}`);
      if (anchor) {
        const headings = [...fs.readFileSync(resolved, 'utf8').matchAll(/^#+ (.+)$/gm)]
          .map(m => m[1].toLowerCase().replace(/[^\w -]/g, '').replace(/ /g, '-'));
        assert.ok(headings.includes(anchor), `Missing local section: ${target}`);
      }
    }
  }
  assert.doesNotMatch(prompt, /(?:\.\.\/|references\/|SECURITY\.md|docs\/lore\/)/);
});

test('minimal prompt retains the safety gate, ordered objectives and phase checks', () => {
  const prompt = fs.readFileSync(path.join(helpers, '..', 'SKILL.md'), 'utf8');
  assert.deepEqual([...prompt.matchAll(/^\| (\d{2}) \|/gm)].map(m => m[1]), numbers);
  for (const rule of [
    /Before requesting inputs or generating anything/,
    /including fallback/,
    /hidden workspace context/,
    /There is no seeded override, including for maintainers/,
    /Do not stage generated or historical material in a model evaluation/,
    /not cleared for distribution/,
    /no imitation Start button or taskbar/i,
    /### Checkpoint 1:/, /### Checkpoint 2:/, /### Checkpoint 3:/, /### Checkpoint 4:/,
    /pwsh -NoProfile/, /@microsoft\/vally-cli/, /globally unique/,
    /no-go.*valid/i, /simulated.*approval/i
  ]) assert.match(prompt, rule);
});

test('only a matching, pinned instruction-evaluation binding reaches the offline stub', t => {
  const route = { model: 'test-model', service: 'test-service', selection: 'pinned', fallback: 'none' };
  const request = { purpose: 'workshop-instruction-evaluation', inputMode: 'unseeded', source: 'procedural-instructions', audience: 'local', route };
  const cases = [
    ['matching metadata', request, structuredClone(request), 1],
    ['no trusted record', request, null, 0],
    ['self-attestation', request, { approved: true }, 0],
    ['record for generation', request, { ...request, purpose: 'workshop' }, 0],
    ['model training', { ...request, purpose: 'model-training' }, request, 0],
    ['seeded request', { ...request, inputMode: 'seeded' }, request, 0],
    ['cross-team use', { ...request, audience: 'cross-team' }, request, 0],
    ...['fixture','workspace','hidden-context','upload','inline-example','url','transcript','image','unknown'].map(source =>
      [source, { ...request, source }, { ...request, source }, 0]),
    ...[{ service: 'different-service' }, { model: 'different-model' }, { selection: 'auto' },
      { model: 'auto' }, { service: '' }, { fallback: 'auto' }, { fallback: null },
      { fallbackRoutes: ['unspecified'] }].map(change =>
      [JSON.stringify(change), { ...request, route: { ...route, ...change } }, request, 0]),
    ['unverified fallback in record', request, { ...request, route: { ...route, fallback: 'unknown' } }, 0],
    ['unknown effective route', { ...request, route: null }, request, 0]
  ];
  for (const [name, operation, record, expected] of cases) {
    const stub = t.mock.fn();
    if (evaluationBlock(operation, record) === null) stub();
    assert.equal(stub.mock.callCount(), expected, name);
  }
});

test('supported entry stays closed; the lint suite declares twelve cases with no staging', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.scripts.eval, 'node scripts/eval-preflight.cjs');
  const result = spawnSync(process.execPath, ['scripts/eval-preflight.cjs', '--approved'], {
    cwd: repo, encoding: 'utf8', env: { ...process.env, EVAL_APPROVED: 'true' }
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No trusted execution record.*npm run eval:lint/);
  const spec = fs.readFileSync(path.join(repo, suite), 'utf8');
  assert.deepEqual([...spec.matchAll(/^  - name: quest-(\d{2})-/gm)].map(m => m[1]), numbers);
  assert.equal((spec.match(/^    graders:/gm) || []).length, 12);
  const graders = [...spec.matchAll(/^        name: (.+)$/gm)].map(m => m[1]);
  assert.equal(new Set(graders).size, graders.length, 'Grader names must be globally unique');
  assert.doesNotMatch(spec, /^\s*(?:agent_environment|files|src|dest):/m);
});

test('repository and installed checker agree on a separate data-free scaffold', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'workshop-check-'));
  const out = path.join(temp, 'output');
  const isolatedPack = path.join(temp, 'customer', '.github', 'skills', 'legacy-quest-formula');
  function write(rel, content) {
    const file = path.join(out, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  const checker = 'Test-QuestReadiness.ps1';
  const artifact = { scope: 'app/web', method: 'manual', modelChannelCategory: null };
  const manifest = { schemaVersion: 1, purpose: 'workshop', inputMode: 'unseeded', intendedAudience: 'local',
    distributionStatus: 'not-cleared', artifacts: [artifact] };
  const withArtifact = changes => ({ ...manifest, artifacts: [{ ...artifact, ...changes }] });
  const unknown = /Governance readiness not met: origin unknown/;

  // Only the local temporary inventory varies between runs. No generator or executor is used.
  function check(rows) {
    const probe = `
      $ErrorActionPreference = 'Stop'
      $file = Join-Path $env:CHECK_OUTPUT 'docs/workshop-data.json'
      $rows = ConvertFrom-Json -AsHashtable -InputObject ([Console]::In.ReadToEnd())
      foreach ($row in $rows) {
        if ($null -eq $row.raw) { [IO.File]::Delete($file) } else { [IO.File]::WriteAllText($file, $row.raw) }
        foreach ($script in @($env:REPO_CHECKER, $env:PACK_CHECKER, (Join-Path $env:CHECK_OUTPUT 'scripts/Test-QuestReadiness.ps1'))) {
          try { $message = (& $script -OutputPath $env:CHECK_OUTPUT) -join ' '; $ok = $true }
          catch { $message = $_.Exception.Message; $ok = $false }
          ConvertTo-Json -Compress -InputObject @{ok=$ok; message=$message}
        }
      }`;
    const input = rows.map(([, data]) => ({ raw: data == null || typeof data === 'string' ? data : JSON.stringify(data) }));
    const run = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', probe], { encoding: 'utf8',
      env: { ...process.env, CHECK_OUTPUT: out, REPO_CHECKER: path.join(helpers, checker),
        PACK_CHECKER: path.join(isolatedPack, 'scripts', checker) }, input: JSON.stringify(input) });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stderr);
    const results = run.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
    assert.equal(results.length, rows.length * 3);
    rows.forEach(([name, , failure], i) => {
      const pair = results.slice(i * 3, i * 3 + 3);
      assert.deepEqual(pair[0], pair[1], name);
      assert.deepEqual(pair[0], pair[2], name);
      assert.equal(pair[0].ok, !failure, `${name}: ${pair[0].message}`);
      assert.match(pair[0].message, failure || /Distribution: not-cleared.*does not verify origin/);
    });
  }

  try {
    fs.cpSync(path.dirname(helpers), isolatedPack, { recursive: true });
    write('README.md', '[Start](quests/01-practice/README.md)\n');
    write('app/web/index.html', '<!doctype html><title>Offline scaffold</title><main></main>');
    write('docs/images/eagledesk.png', Buffer.alloc(0)); // Presence test, not a screen capture.
    write('package.json', '{"private":true}');
    write(suite, fs.readFileSync(path.join(repo, suite)));
    for (const script of [checker, 'Test-QuestFlag.ps1']) write(`scripts/${script}`, fs.readFileSync(path.join(helpers, script)));
    write('scripts/LICENSE', fs.readFileSync(path.join(helpers, '..', 'LICENSE')));
    const clues = numbers.map(n => ({ quest: Number(n), file: `quests/${n}-practice/README.md`, marker: `marker-${n}` }));
    for (const { quest, file, marker } of clues) write(file, `[Home](../../README.md)\n\n${marker}: check-${quest}\n`);
    write('quests/clues.json', JSON.stringify(clues));
    write('quests/flags.sha256', numbers.map(n =>
      `${n} ${createHash('sha256').update(`check-${Number(n)}`).digest('hex')}`).join('\n'));
    for (const [flag, expected] of [['check-1', 0], ['incorrect', 1]]) {
      const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File',
        path.join(isolatedPack, 'scripts', 'Test-QuestFlag.ps1'), '-OutputPath', out, '-Quest', '1', '-Flag', flag],
      { encoding: 'utf8' });
      assert.ifError(result.error);
      assert.equal(result.status, expected, result.stderr);
      assert.match(result.stdout + result.stderr, expected ? /Flag does not match/ : /does not establish competency/);
    }
    fs.mkdirSync(path.join(temp, 'outside'));
    fs.symlinkSync(path.join(temp, 'outside'), path.join(out, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');

    const { modelChannelCategory, ...missingCategory } = artifact;
    check([
      ['manual file group', manifest],
      ['mixed origins', { ...manifest, artifacts: [
        ...['organization-managed','third-party-managed','on-device'].map(channel => ({
          scope: 'app/web/index.html', method: 'model', modelChannelCategory: channel })),
        { ...artifact, scope: 'docs/images/eagledesk.png', method: 'deterministic' }
      ] }],
      ['older output', null, unknown], ['bad JSON', '{', unknown], ['wrong root', [manifest], unknown],
      ['duplicate field', JSON.stringify(manifest).replace('"schemaVersion":1', '"schemaVersion":2,"schemaVersion":1'), unknown],
      ...[{ schemaVersion: '1' }, { schemaVersion: 2 }, { purpose: 'model-training' }, { inputMode: 'seeded' },
        { intendedAudience: 'cross-team' }, { distributionStatus: 'cleared' }, { rawInput: 'omitted' },
        { artifacts: [] }, { artifacts: artifact }, { artifacts: [missingCategory] }].map(change =>
        [JSON.stringify(change), { ...manifest, ...change }, unknown]),
      ...[{ method: 'unknown' }, { method: 'model' }, { method: 'Model' }, { modelChannelCategory: 'on-device' },
        { method: 'model', modelChannelCategory: 'https://example.invalid' }, { credential: 'omitted' }].map(change =>
        [JSON.stringify(change), withArtifact(change), unknown]),
      ...['.', '../outside', 'app/../README.md', 'missing', 'linked', 'linked/child', 'app/*', 'app\\web',
        'C:relative', '//share/path', 'https://example.invalid', path.join(out, 'README.md'), 'docs/workshop-data.json'].map(scope =>
        [`invalid scope ${scope}`, withArtifact({ scope }), unknown])
    ]);
    write('README.md', '[Broken](missing.md)\n');
    check([['broken local navigation', manifest, /Broken or out-of-output local link/]]);
    write('README.md', '[Outside](../outside)\n');
    check([['escaping link', manifest, /Broken or out-of-output local link/]]);
    write('README.md', '[Through a junction](linked/../README.md)\n');
    check([['link must not traverse a junction before a parent component', manifest, /Broken or out-of-output local link/]]);
    write('README.md', '[Start](quests/01-practice/README.md)\n');
    const originalHashes = fs.readFileSync(path.join(out, 'quests', 'flags.sha256'), 'utf8');
    write('quests/flags.sha256', originalHashes.replace(/[a-f0-9]{64}/, '0'.repeat(64)));
    check([['incorrect clue hash', manifest, /Flag hash mismatch/]]);
    write('quests/flags.sha256', originalHashes);
    const clueFile = clues[0].file;
    const originalClue = fs.readFileSync(path.join(out, clueFile), 'utf8');
    write(clueFile, `${originalClue}\n${clues[0].marker}: duplicate\n`);
    check([['duplicate clue marker', manifest, /Expected one marker-01 marker/]]);
    write(clueFile, originalClue);
    fs.renameSync(path.join(out, 'scripts', checker), path.join(out, 'scripts', 'temporarily-absent.ps1'));
    const missing = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', path.join(isolatedPack, 'scripts', checker),
      '-OutputPath', out], { encoding: 'utf8' });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /Missing or unsafe required output file/);
    fs.renameSync(path.join(out, 'scripts', 'temporarily-absent.ps1'), path.join(out, 'scripts', checker));
    write(suite, fs.readFileSync(path.join(repo, suite), 'utf8').replace('quest-12-', 'quest-11-'));
    check([['missing quest stimulus', manifest, /one Vally stimulus for each/]]);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
