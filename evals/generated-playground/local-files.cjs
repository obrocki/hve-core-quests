'use strict';

const fs = require('node:fs');
const path = require('node:path');

class CheckError extends Error {
  constructor(message, status = 'fail') {
    super(message);
    this.status = status;
  }
}

function requireEvidence(condition, message) {
  if (!condition) throw new CheckError(message);
}

function hasFields(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' &&
    !relative.startsWith(`..${path.sep}`));
}

function localDirectory(value) {
  if (!value) throw new CheckError('No local directory was supplied.', 'not-testable');
  requireEvidence(path.isAbsolute(value) && !/^[\\/]{2}/.test(value), 'Expected an absolute local directory.');
  const directory = path.resolve(value);
  requireEvidence(directory !== path.parse(directory).root, 'A volume root is not a valid directory.');
  for (let item = directory; item !== path.dirname(item); item = path.dirname(item)) {
    const stat = fs.lstatSync(item, { throwIfNoEntry: false });
    requireEvidence(stat?.isDirectory() && !stat.isSymbolicLink(), 'Directory is missing or passes through a link.');
  }
  return directory;
}

function localItem(root, relative, type = 'file') {
  requireEvidence(typeof relative === 'string' && relative.split('/').every(part =>
    part && part !== '.' && part !== '..' &&
    !/[\\:<>"|?*\x00-\x1f]|[. ]$|^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)),
  'Expected a safe output-relative path.');
  const parts = relative.split('/');
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    const expected = index < parts.length - 1 ? 'directory' : type;
    requireEvidence(stat && !stat.isSymbolicLink() && (expected === 'item'
      ? stat.isFile() || stat.isDirectory()
      : expected === 'file' ? stat.isFile() : stat.isDirectory()),
    'Evidence is missing, the wrong file type, or linked.');
  }
  return current;
}

function readText(root, relative) {
  const file = localItem(root, relative);
  requireEvidence(fs.statSync(file).size <= 8 * 1024 * 1024, 'A text evidence file exceeds the local checker limit.');
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function readJson(root, relative) {
  const text = readText(root, relative);
  try {
    return JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new CheckError('Evidence contains malformed JSON.');
  }
}

function fileList(root, relative = '') {
  const directory = relative ? localItem(root, relative, 'directory') : root;
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['.git', 'node_modules'].includes(entry.name)) return [];
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    requireEvidence(!entry.isSymbolicLink(), 'The output contains a link or junction.');
    if (entry.isDirectory()) return fileList(root, next);
    requireEvidence(entry.isFile(), 'The output contains a non-regular file.');
    return [next];
  });
}

function reportError(error) {
  if (error instanceof CheckError) return { status: error.status, evidence: error.message };
  return { status: 'error', evidence: `Local checker error (${error.code || error.name}).` };
}

module.exports = { CheckError, requireEvidence, hasFields, inside, localDirectory, localItem, readText, readJson, fileList, reportError };
