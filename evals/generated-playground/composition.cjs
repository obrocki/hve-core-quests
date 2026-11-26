'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { parse } = require('yaml');
const {
  authorRoot, CheckError, requireEvidence, hasFields, playgroundDirectory, localItem,
  readText, readJson, sha256, fileList, reportError
} = require('./local-files.cjs');
const { inspectFrontend, observeOfflineStartup } = require('./frontend.cjs');

const pack = path.join(authorRoot, '.github', 'skills', 'legacy-quest-formula');
const questIds = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const assets = {
  'scripts/Test-QuestReadiness.ps1': 'scripts/Test-QuestReadiness.ps1',
  'scripts/Test-QuestFlag.ps1': 'scripts/Test-QuestFlag.ps1',
  'scripts/LICENSE': 'LICENSE'
};
const outputSpec = 'evals/eagledesk-quests/eval.yaml';
const screenshot = 'docs/images/eagledesk.png';
const recognizedLicenses = new Set([
  '0BSD', 'Apache-2.0', 'BlueOak-1.0.0', 'BSD-2-Clause', 'BSD-3-Clause', 'CC0-1.0', 'ISC', 'MIT',
  'MPL-2.0', 'PostgreSQL', 'Python-2.0', 'Unlicense', 'Zlib', 'GPL-2.0-only', 'GPL-2.0-or-later',
  'GPL-3.0-only', 'GPL-3.0-or-later', 'LGPL-2.1-only', 'LGPL-2.1-or-later',
  'LGPL-3.0-only', 'LGPL-3.0-or-later'
]);

function runPowerShell(args, input, env, name) {
  const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', ...args], {
    input, env: { ...process.env, ...env }, timeout: 120_000, windowsHide: true
  });
  if (result.error?.code === 'ENOENT') throw new CheckError('PowerShell 7 is unavailable.', 'not-testable');
  if (result.error || result.status === null) throw new CheckError(`${name} did not finish.`, 'error');
  requireEvidence(result.status === 0, `${name} failed (exit ${result.status}); run the bundled checker locally for details.`);
}

function hasNoSetup(object, seen = new Set()) {
  if (!object || typeof object !== 'object' || seen.has(object)) return true;
  seen.add(object);
  return Object.entries(object).every(([key, value]) =>
    !/^(?:agent_environment|environment|grading_environment|attachments|golden_.+|simulation|params|includes?)$/.test(key) &&
    hasNoSetup(value, seen));
}

function readiness(root) {
  runPowerShell(['-File', path.join(pack, assets['scripts/Test-QuestReadiness.ps1']), '-OutputPath', root],
    undefined, {}, 'Pack structural readiness');
  const instructions = fileList(root, '.github/instructions').filter(file => file.endsWith('.instructions.md'));
  requireEvidence(instructions.some(file => /^---\r?\n[\s\S]*?^applyTo:\s*\S/m.test(readText(root, file))),
    'A scoped agent instruction is missing.');
  return 'The trusted structural checker passed and scoped instructions are present; declarations do not authorize use.';
}

function captureContainer(root) {
  const image = localItem(root, screenshot);
  const size = fs.statSync(image).size;
  requireEvidence(size >= 57, 'The PNG container is truncated.');
  const header = Buffer.alloc(33);
  const end = Buffer.alloc(12);
  const handle = fs.openSync(image, 'r');
  try {
    fs.readSync(handle, header, 0, header.length, 0);
    fs.readSync(handle, end, 0, end.length, size - end.length);
  } finally {
    fs.closeSync(handle);
  }
  requireEvidence(header.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' &&
    header.readUInt32BE(8) === 13 && header.toString('ascii', 12, 16) === 'IHDR' &&
    header.readUInt32BE(16) > 0 && header.readUInt32BE(20) > 0 && end.toString('hex') === '0000000049454e44ae426082',
  'Expected PNG signature, image dimensions and a final IEND chunk.');
  return 'PNG container markers are present; neither pixels nor capture authenticity were verified.';
}

async function proceduralSuite(root) {
  const { validateEvalSpec, createDefaultGraderRegistry } = await import('@microsoft/vally');
  let spec;
  try {
    spec = parse(readText(root, outputSpec));
  } catch (error) {
    if (error.name !== 'YAMLParseError') throw error;
    throw new CheckError('The generated Vally spec is malformed.');
  }
  requireEvidence(spec && hasNoSetup(spec), 'The generated Vally spec declares fixture setup or imported inputs.');
  const lint = validateEvalSpec(spec, { registry: createDefaultGraderRegistry() });
  requireEvidence(lint.valid, 'The generated procedural Vally spec fails static validation with the author Vally version.');
  requireEvidence(spec.stimuli.length === 12 &&
    new Set(spec.stimuli.map(stimulus => /^quest-(0[1-9]|1[0-2])(?:-|$)/.exec(stimulus.name)?.[1])
      .filter(Boolean)).size === 12, 'The generated spec needs one stimulus for each of the twelve quests.');
  const names = spec.stimuli.flatMap(item => (item.graders ?? []).map(grader => grader.name));
  requireEvidence(spec.stimuli.every(item => item.graders?.length) &&
    names.every(Boolean) && new Set(names).size === names.length,
  'Each generated stimulus needs a uniquely named expectation.');
  return 'Twelve unstaged procedural cases passed static Vally validation; none was executed.';
}

function questBriefs(root) {
  const entries = fs.readdirSync(localItem(root, 'quests', 'directory'), { withFileTypes: true })
    .filter(entry => /^\d{2}-/.test(entry.name));
  requireEvidence(entries.length === 12 && entries.every(entry => entry.isDirectory() && !entry.isSymbolicLink()),
    'Expected twelve numbered quest directories.');
  for (const quest of questIds) {
    const matches = entries.filter(entry => entry.name.startsWith(`${quest}-`));
    requireEvidence(matches.length === 1 && matches[0].name.length > 3 &&
      /\S/.test(readText(root, `quests/${matches[0].name}/README.md`)),
    `Quest ${quest} does not have exactly one nonempty brief.`);
  }
  return 'Each quest from 01 to 12 has a nonempty brief; pedagogical quality requires review.';
}

function packIntegrity(root) {
  for (const [target, source] of Object.entries(assets)) {
    const expected = fs.readFileSync(path.join(pack, source));
    requireEvidence(fs.statSync(localItem(root, target)).size === expected.length &&
      expected.equals(fs.readFileSync(localItem(root, target))), `Bundled asset differs from the author pack: ${target}.`);
  }
  return 'Both checkers and the MIT notice match the trusted pack byte for byte.';
}

function tierWiring(root) {
  const { resourceCount, hasThreeTiers } = inspectFrontend(root);
  requireEvidence(hasThreeTiers, 'No static chain connects a live frontend script through two distinct local source files.');
  return `A three-source chain and ${resourceCount} static local resource(s) resolved; execution is checked separately.`;
}

function dependencyEvidence(root) {
  const files = fileList(root);
  const manifests = files.filter(file => /(?:^|\/)package\.json$/.test(file));
  const pkg = readJson(root, 'package.json');
  const version = pkg?.devDependencies?.['@microsoft/vally-cli'];
  requireEvidence(typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version) &&
    !pkg.devDependencies.vally && !pkg.dependencies?.vally,
  'The author-tooling dependency must pin @microsoft/vally-cli, not vally.');
  requireEvidence(!Object.values(pkg.scripts ?? {}).some(script => typeof script === 'string' &&
    /\bvally(?:\.cmd)?\s+(?:eval|compare|experiment|serve)\b/i.test(script)),
  'The generated npm scripts expose live Vally execution or serving.');

  let count = 0;
  let unknown = 0;
  for (const manifest of manifests) {
    const prefix = manifest.slice(0, -'package.json'.length);
    const declared = manifest === 'package.json' ? pkg : readJson(root, manifest);
    const groups = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
    const direct = groups.flatMap(field => Object.keys(declared[field] ?? {}));
    if (!direct.length) continue;
    const lock = readJson(root, `${prefix}package-lock.json`);
    requireEvidence([2, 3].includes(lock?.lockfileVersion) && lock.packages?.[''],
      'Expected a generated npm lockfile with package-level metadata.');
    requireEvidence(groups.every(group => isDeepStrictEqual(declared[group] ?? {}, lock.packages[''][group] ?? {})),
      'The dependency declarations and lockfile root inventory disagree.');
    if (!prefix) requireEvidence(lock.packages[''].devDependencies?.['@microsoft/vally-cli'] === version &&
      lock.packages['node_modules/@microsoft/vally-cli']?.version === version, 'Generated Vally lock and manifest disagree.');
    requireEvidence(direct.every(name => Object.hasOwn(lock.packages, `node_modules/${name}`)),
      'A declared npm component is absent from the lockfile.');
    for (const [name, component] of Object.entries(lock.packages)) {
      if (!name || !name.includes('node_modules/')) continue;
      count++;
      requireEvidence(component && !/^(?:unlicensed|proprietary|all rights reserved)$/i.test(component.license?.trim() ?? ''),
        'A locked npm component declares a non-open license.');
      if (typeof component.version !== 'string' || component.link ||
          !/^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/.test(component.integrity ?? '') ||
          !recognizedLicenses.has(component.license)) unknown++;
    }
  }
  const otherManagers = files.filter(file => /(?:\.(?:csproj|fsproj|vbproj)$|(?:^|\/)(?:Cargo\.toml|go\.mod|pom\.xml|pyproject\.toml|requirements[^/]*\.txt|(?:Dockerfile|Containerfile)(?:\.[^/]+)?|(?:docker-)?compose(?:\.[^/]+)?\.ya?ml)$)/i.test(file));
  const vendored = files.filter(file => /(?:^|\/)(?:vendor|third-party)\//i.test(file) ||
    /\.(?:min\.js|woff2?|ttf|otf)$/i.test(file));
  if (unknown || otherManagers.length || vendored.length) {
    throw new CheckError(`${unknown} npm lock entries, ${otherManagers.length} other manifests and ${vendored.length} possible vendored files need separate license review.`,
      'not-testable');
  }
  return `${count} locked npm components declare a recognized open license and integrity; vendored and asset licensing require review.`;
}

function clueDiscovery(root) {
  const clues = readJson(root, 'quests/clues.json');
  requireEvidence(Array.isArray(clues) && clues.length === 12, 'Expected a twelve-entry JSON clue array.');
  const lines = readText(root, 'quests/flags.sha256').replace(/\r?\n$/, '').split(/\r?\n/);
  requireEvidence(lines.length === 12 && lines.every(line => /^(0[1-9]|1[0-2]) [a-f0-9]{64}$/.test(line)),
    'Expected exactly twelve strictly formatted lowercase SHA-256 rows.');
  const hashes = new Map(lines.map(line => [line.slice(0, 2), line.slice(3)]));
  requireEvidence(hashes.size === 12, 'Flag rows repeat a quest number.');

  const markers = new Set();
  const seen = new Set();
  const flags = [];
  for (const clue of clues) {
    requireEvidence(hasFields(clue, ['quest', 'file', 'marker']) && Number.isInteger(clue.quest) &&
      clue.quest >= 1 && clue.quest <= 12 && !seen.has(clue.quest) && typeof clue.marker === 'string' &&
      clue.marker.trim() === clue.marker && clue.marker.length > 0 && !/[:\r\n]/.test(clue.marker) &&
      !markers.has(clue.marker.toLowerCase()),
    'Clue manifest has an invalid or repeated quest or marker.');
    seen.add(clue.quest);
    markers.add(clue.marker.toLowerCase());
    const prefix = `${clue.marker}: `;
    const markerPrefix = `${clue.marker.toLowerCase()}:`;
    const matching = readText(root, clue.file).split(/\r?\n/).filter(line => line.toLowerCase().startsWith(markerPrefix));
    requireEvidence(matching.length === 1 && matching[0].startsWith(prefix) &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(matching[0].slice(prefix.length)),
    'A clue source does not have exactly one correctly formatted marker line.');
    const value = matching[0].slice(prefix.length);
    const hash = sha256(value);
    requireEvidence(hash === hashes.get(questIds[clue.quest - 1]), `Flag hash does not match for quest ${clue.quest}.`);
    flags.push({ quest: clue.quest, value });
  }
  runPowerShell(['-Command', `
    $ErrorActionPreference = 'Stop'
    $flags = ConvertFrom-Json -InputObject ([Console]::In.ReadToEnd())
    foreach ($flag in $flags) {
      & $env:HVE_PACK_FLAG_CHECKER -OutputPath $env:HVE_CHECK_ROOT -Quest $flag.quest -Flag $flag.value | Out-Null
    }
  `], JSON.stringify(flags), {
    HVE_PACK_FLAG_CHECKER: path.join(pack, assets['scripts/Test-QuestFlag.ps1']),
    HVE_CHECK_ROOT: root
  }, 'Pack flag checks');
  return 'All twelve local marker hashes and packaged flag checks passed; this is discovery only.';
}

function unseededInventory(root) {
  const inventory = readJson(root, 'docs/workshop-data.json');
  requireEvidence(hasFields(inventory, ['schemaVersion', 'purpose', 'inputMode', 'intendedAudience', 'distributionStatus', 'artifacts']) &&
    inventory.schemaVersion === 1 && inventory.purpose === 'workshop' &&
    inventory.inputMode === 'unseeded' && inventory.intendedAudience === 'local' &&
    inventory.distributionStatus === 'not-cleared' && Array.isArray(inventory.artifacts) && inventory.artifacts.length,
  'Expected the version-one local unseeded inventory with distribution not cleared.');
  const scopes = inventory.artifacts.map(artifact => {
    requireEvidence(hasFields(artifact, ['scope', 'method', 'modelChannelCategory']) && typeof artifact.scope === 'string' &&
      /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(artifact.scope) && artifact.scope.toLowerCase() !== 'docs/workshop-data.json',
    'An inventory scope does not name an output file or directory.');
    requireEvidence(artifact.method === 'model'
      ? ['organization-managed', 'third-party-managed', 'on-device'].includes(artifact.modelChannelCategory)
      : ['manual', 'deterministic'].includes(artifact.method) && artifact.modelChannelCategory === null,
    'An inventory entry has an unknown or inconsistent method and model-channel declaration.');
    localItem(root, artifact.scope, 'item');
    return artifact.scope;
  });
  const scoped = fileList(root).filter(file => file !== 'docs/workshop-data.json' &&
    (file === 'README.md' || /^(?:app|docs|quests)\//.test(file)));
  requireEvidence(scoped.every(file => scopes.some(scope => scope === file || file.startsWith(`${scope}/`))),
    'At least one generated app, document, quest or capture file is missing from the inventory scopes.');
  return `${scoped.length} workshop files are covered by declared local scopes; coverage does not verify origin or clearance.`;
}

const checks = {
  readiness,
  'pack-integrity': packIntegrity,
  'quest-briefs': questBriefs,
  'capture-container': captureContainer,
  'procedural-suite': proceduralSuite,
  'tier-wiring': tierWiring,
  'offline-startup': (root, options) => {
    const graph = inspectFrontend(root);
    requireEvidence(graph.hasThreeTiers, 'Offline startup requires a statically wired local frontend.');
    return observeOfflineStartup(root, options.chromium);
  },
  'dependency-evidence': dependencyEvidence,
  'clue-discovery': clueDiscovery,
  'unseeded-inventory': unseededInventory
};

async function checkComposition(root, check, options = {}) {
  try {
    requireEvidence(Object.hasOwn(checks, check), 'Unknown composition check.');
    return { check, status: 'pass', evidence: await checks[check](playgroundDirectory(root), options) };
  } catch (error) {
    return { check, ...reportError(error) };
  }
}

module.exports = { checkComposition, compositionChecks: Object.keys(checks), hasNoSetup, questIds };
