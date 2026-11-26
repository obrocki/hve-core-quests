'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { CheckError, requireEvidence, hasFields, localDirectory, localItem, readText, readJson, reportError } = require('./local-files.cjs');

const outcomes = {
  '01': ['launch', 'offline-boundary', 'verified-behavior'],
  '02': ['presentation', 'application', 'data', 'unknowns'],
  '03': ['roles', 'journey', 'inclusion', 'unvalidated'],
  '04': ['measure', 'scope', 'failure', 'first-slice'],
  '05': ['priority', 'dependencies', 'acceptance', 'tracker-gate'],
  '06': ['alternatives', 'decision', 'runtime-boundary'],
  '07': ['reproduction', 'control', 'causal-limit'],
  '08': ['assets', 'trust-boundary', 'proposed-controls', 'approval-gate'],
  '09': ['inventory', 'licenses', 'build-evidence', 'limits'],
  '10': ['keyboard', 'status', 'data-flow', 'safeguards', 'unperformed'],
  '11': ['feature-assessment', 'decision', 'reconsideration'],
  '12': ['small-slice', 'regression', 'review', 'report']
};
const gateStates = new Set(['not-run', 'blocked', 'reported']);

function substantive(value) {
  return typeof value === 'string' && value.trim().split(/\s+/).length >= 3;
}

function sourceFiles(root, references) {
  requireEvidence(Array.isArray(references) && references.length, 'An outcome has no source references.');
  return references.map(reference => {
    requireEvidence(hasFields(reference, ['path', 'line']) && typeof reference.path === 'string' &&
      !/^\.hve-walkthrough(?:\/|$)/i.test(reference.path) &&
      Number.isInteger(reference.line) && reference.line > 0,
    'An outcome references itself or lacks a valid source line.');
    const source = readText(root, reference.path).split(/\r?\n/);
    requireEvidence(source[reference.line - 1]?.trim(), 'A cited local line is missing or blank.');
    return path.relative(root, fs.realpathSync(localItem(root, reference.path))).split(path.sep).join('/');
  });
}

function checkRunRecords(quest, runs, runtime) {
  if (quest !== '07' && quest !== '12') return;
  if (runtime !== 'reported') throw new CheckError('This quest requires execution evidence, not a planned demonstration.', 'not-testable');
  const record = value => typeof value?.command === 'string' && value.command.trim() &&
    Number.isInteger(value.exit) && value.exit >= 0;
  if (quest === '07') {
    requireEvidence(hasFields(runs, ['conflict', 'control']) && record(runs.conflict) && record(runs.control) &&
      runs.conflict.detected === true && runs.control.detected === false,
    'Reported reproduction and control observations do not discriminate the conflict.');
  } else {
    requireEvidence(hasFields(runs, ['red', 'green', 'regression']) && Object.values(runs).every(record) &&
      runs.red.exit !== 0 && runs.green.exit === 0 && runs.regression.exit === 0 &&
      runs.red.command.trim() === runs.green.command.trim(),
    'Reported regression evidence lacks a failing/passing pair for one test command and a passing preserved check.');
  }
}

function checkBehavior(workspace, quest) {
  const result = {
    check: quest,
    native: 'not-testable',
    human: 'not-testable',
    runtime: 'not-testable'
  };
  try {
    requireEvidence(Object.hasOwn(outcomes, quest), 'Unknown walkthrough quest.');
    const root = localDirectory(workspace);
    const artifact = readText(root, `.hve-walkthrough/${quest}.md`);
    const receipt = readJson(root, `.hve-walkthrough/${quest}.json`);
    requireEvidence(substantive(artifact) && receipt?.quest === Number(quest) &&
      hasFields(receipt.gates, ['native', 'human', 'runtime']) && Object.values(receipt.gates).every(gate => gateStates.has(gate)),
    'Expected a nonempty artifact and separate native, human and runtime gate declarations.');
    result.reported = receipt.gates;
    if (receipt.artifact === 'blocked') throw new CheckError('Quest authorship was reported blocked.', 'not-testable');
    requireEvidence(receipt.artifact === 'ready' && hasFields(receipt.outcomes, outcomes[quest]) &&
      Array.isArray(receipt.limits) && receipt.limits.some(substantive),
    'Quest evidence is missing required outcome records or limitations.');
    const references = {};
    for (const [key, outcome] of Object.entries(receipt.outcomes)) {
      requireEvidence(hasFields(outcome, ['finding', 'sources']) && substantive(outcome.finding),
        'An outcome lacks a finding and source references.');
      references[key] = sourceFiles(root, outcome.sources);
    }
    if (quest === '01') requireEvidence(references.launch.includes('app/web/index.html'),
      'The launch finding does not cite the actual offline entry point.');
    if (quest === '02') requireEvidence(references.presentation.some(ui =>
      references.application.some(logic => logic !== ui &&
        references.data.some(data => data !== logic && data !== ui))),
    'The trace does not cite separate presentation, application and data sources.');
    checkRunRecords(quest, receipt.runs, receipt.gates.runtime);
    return { ...result, status: 'pass', evidence: 'Local artifact and referenced evidence shape passed; claims and gates remain unverified.' };
  } catch (error) {
    return { ...result, ...reportError(error) };
  }
}

module.exports = { checkBehavior, outcomes };
