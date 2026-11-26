'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { checkBehavior } = require('./behavior.cjs');
const { CheckError, playgroundDirectory } = require('./local-files.cjs');
const { profile, steps } = require('./hve-steps.cjs');
const { checkNative } = require('./hve-trace.cjs');

function attestedProfile(provider, attestedProvider) {
  return provider === attestedProvider ? profile(provider) : null;
}

function artifactStatus(workspace, quest) {
  const directory = path.join(workspace, '.hve-walkthrough');
  const stat = fs.lstatSync(directory, { throwIfNoEntry: false });
  if (!stat || (stat.isDirectory() && !stat.isSymbolicLink() && ['md', 'json'].some(ext =>
    !fs.lstatSync(path.join(directory, `${quest}.${ext}`), { throwIfNoEntry: false })))) return 'not-run';
  const result = checkBehavior(workspace, quest);
  return result.status === 'not-testable' ? 'not-run' : result.status;
}

function nativeVally(quest, env) {
  const requested = attestedProfile(env.HVE_QUEST_PROVIDER, env.HVE_QUEST_ATTESTED_PROVIDER);
  let result = { status: 'not-run', code: 'provider-attestation-required' };
  if (requested) {
    try {
      const workspace = playgroundDirectory(env.EVALUATE_WORKSPACE);
      result = checkNative(workspace, quest, env.HVE_QUEST_TRACE, env.HVE_QUEST_ENTRIES?.split(','));
    } catch (error) {
      result = { status: 'not-run', code: error instanceof CheckError ? 'unsafe-or-missing-workspace' : 'workspace-checker-error' };
    }
  }
  const passed = result.status === 'observed';
  // Vally has no not-run verdict for a program grader. Preserve it separately from the transport status.
  return { name: 'native-hve', kind: 'code', status: passed ? 'success' : 'error',
    passed, score: Number(passed), evidence: result.code, metadata: { native: result } };
}

function main([lane, ...args]) {
  const commonOptions = { provider: { type: 'string' }, 'attested-provider': { type: 'string' } };
  let options;
  try {
    if (!['preflight', 'grade'].includes(lane)) throw new CheckError('unsupported-phase');
    options = parseArgs({
      args,
      options: lane === 'preflight' ? commonOptions : {
        ...commonOptions, quest: { type: 'string' }, workspace: { type: 'string' },
        trace: { type: 'string' }, entry: { type: 'string', multiple: true }
      }
    }).values;
  } catch (error) {
    if (!(error instanceof CheckError) && !error.code?.startsWith('ERR_PARSE_ARGS_')) throw error;
    console.log(JSON.stringify({ status: 'blocked', code: 'invalid-lane-options' }));
    return 2;
  }
  const provider = options.provider;
  const settings = attestedProfile(provider, options['attested-provider']);
  if (!settings) {
    console.log(JSON.stringify({ status: 'blocked', code: 'provider-attestation-required' }));
    return 2;
  }
  if (lane === 'preflight') {
    console.log(JSON.stringify({
      schemaVersion: 1, provider, attestation: 'user-attested', independentlyVerified: false,
      generation: 'blocked', liveEvaluation: 'blocked', code: 'phase-one-no-live-executor', ...settings
    }));
    return 2;
  }
  if (!Object.hasOwn(steps, options.quest)) {
    console.log(JSON.stringify({ status: 'blocked', code: 'quest-id-required' }));
    return 2;
  }
  let workspace;
  let artifact;
  try {
    workspace = playgroundDirectory(options.workspace);
    artifact = artifactStatus(workspace, options.quest);
  } catch (error) {
    console.log(JSON.stringify({
      status: 'blocked', code: error instanceof CheckError ? 'unsafe-or-missing-workspace' : 'workspace-checker-error'
    }));
    return 2;
  }
  console.log(JSON.stringify({
    schemaVersion: 1, provider, quest: Number(options.quest), attestation: 'user-attested', independentlyVerified: false,
    artifact, native: checkNative(workspace, options.quest, options.trace, options.entry),
    human: 'not-testable', runtime: 'not-testable', semantic: 'uncalibrated'
  }));
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { nativeVally };
