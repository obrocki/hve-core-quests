'use strict';

const { checkComposition, compositionChecks } = require('./composition.cjs');
const { checkBehavior } = require('./behavior.cjs');

async function runVally([kind, check]) {
  const result = kind === 'composition'
    ? await checkComposition(process.env.HVE_QUEST_PLAYGROUND, check, { chromium: process.env.HVE_QUEST_CHROMIUM })
    : kind === 'behavior' ? checkBehavior(process.env.EVALUATE_WORKSPACE, check)
      : { status: 'error', evidence: 'Unknown grader category.' };
  const passed = result.status === 'pass';
  console.log(JSON.stringify({
    name: 'program', kind: 'code', status: ['pass', 'fail'].includes(result.status) ? 'success' : 'error',
    score: Number(passed), passed, evidence: result.evidence, metadata: result
  }));
}

async function main(args) {
  if (args.length > 1) {
    console.error('Expected one absolute playground path or HVE_QUEST_PLAYGROUND.');
    process.exitCode = 2;
    return;
  }
  const root = args[0] ?? process.env.HVE_QUEST_PLAYGROUND;
  const results = [];
  for (const check of compositionChecks) {
    results.push(await checkComposition(root, check, { chromium: process.env.HVE_QUEST_CHROMIUM }));
  }
  console.log(JSON.stringify(results, null, 2));
  process.exitCode = results.some(result => ['error', 'not-testable'].includes(result.status)) ? 2
    : results.some(result => result.status === 'fail') ? 1 : 0;
}

if (require.main === module) void main(process.argv.slice(2));

module.exports = { runVally };
