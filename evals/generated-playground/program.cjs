'use strict';

const { checkComposition, compositionChecks, questIds } = require('./composition.cjs');
const { checkBehavior } = require('./behavior.cjs');

async function runVally([kind, check]) {
  if (kind === 'native') {
    const { nativeVally } = require('./live-lane.cjs');
    console.log(JSON.stringify(nativeVally(check, process.env)));
    return;
  }
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

async function main([kind, argument, ...rest]) {
  if (!['composition', 'evidence'].includes(kind) || rest.length) {
    console.error('Expected composition or evidence, followed by an optional absolute playground path.');
    process.exitCode = 2;
    return;
  }
  const root = argument ?? process.env.HVE_QUEST_PLAYGROUND;
  const results = [];
  if (kind === 'composition') {
    for (const check of compositionChecks) {
      results.push(await checkComposition(root, check, { chromium: process.env.HVE_QUEST_CHROMIUM }));
    }
  } else {
    for (const quest of questIds) results.push(checkBehavior(root, quest));
  }
  console.log(JSON.stringify(results, null, 2));
  process.exitCode = results.some(result => ['error', 'not-testable'].includes(result.status)) ? 2
    : results.some(result => result.status === 'fail') ? 1 : 0;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === 'grade') void runVally(args.slice(1));
  else void main(args);
}
