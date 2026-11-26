'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const acorn = require('acorn');
const { parse } = require('parse5');
const { CheckError, requireEvidence, inside, localItem, readText } = require('./local-files.cjs');

const entry = 'app/web/index.html';
const resourceAttrs = {
  script: ['src'], link: ['href'], img: ['src', 'srcset'], source: ['src', 'srcset'],
  audio: ['src'], video: ['src', 'poster'], track: ['src'], input: ['src'],
  image: ['href', 'xlink:href'], use: ['href', 'xlink:href']
};
const installedTooling = relative => relative.split('/').some(part => part.toLowerCase() === 'node_modules');

function inspectFrontend(root) {
  const files = new Set();
  const scripts = new Map();
  const entryScripts = [];
  const edges = new Map();
  const asset = (owner, reference, allowInline = false) => {
    if (allowInline && /^(?:#|data:)/i.test(reference)) return null;
    requireEvidence(reference && !/^(?:[\\/]|[a-z][a-z0-9+.-]*:)/i.test(reference) &&
      !reference.includes('\\'), 'Frontend references an absolute, remote or empty resource.');
    let url;
    try {
      url = new URL(reference, pathToFileURL(localItem(root, owner)));
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      throw new CheckError('Frontend references an invalid resource URL.');
    }
    requireEvidence(url.protocol === 'file:' && !url.host, 'Frontend resource is not on the local filesystem.');
    const fullPath = fileURLToPath(url);
    requireEvidence(inside(root, fullPath), 'Frontend resource resolves outside the output.');
    const relative = path.relative(root, fullPath).split(path.sep).join('/');
    requireEvidence(!installedTooling(relative),
      'The frontend references installed tooling; opening it must not require npm install.');
    localItem(root, relative);
    files.add(relative);
    return relative;
  };

  const seenStyles = new Set();
  const inspectCss = (owner, css) => {
    const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const references = text.matchAll(/(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)|@import\s+(?:"([^"]*)"|'([^']*)'))/gi);
    for (const match of references) {
      const target = asset(owner, match.slice(1).find(v => v !== undefined), true);
      if (target?.endsWith('.css') && !seenStyles.has(target)) {
        seenStyles.add(target);
        inspectCss(target, readText(root, target));
      }
    }
  };

  const nameAt = node => {
    if (node?.type === 'Identifier') return node.name;
    if (node?.type !== 'MemberExpression') return undefined;
    const base = nameAt(node.object);
    return ['window', 'globalThis', 'self'].includes(base)
      ? node.computed ? node.property.value : node.property.name
      : base;
  };

  const inspectScript = (id, owner, source, module) => {
    if (scripts.has(id)) return;
    let ast;
    try {
      ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: module ? 'module' : 'script' });
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new CheckError('A runnable browser script has invalid JavaScript syntax.');
    }
    const provides = new Set();
    const uses = new Set();
    const dependencies = new Set();
    scripts.set(id, { provides, uses, module });
    edges.set(id, dependencies);

    for (const statement of ast.body) {
      if (statement.type === 'VariableDeclaration') {
        for (const item of statement.declarations) provides.add(item.id.name);
      } else if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') {
        provides.add(statement.id?.name);
      }
    }
    provides.delete(undefined);

    const walk = node => {
      if (!node || typeof node.type !== 'string') return;
      if (node.type === 'CallExpression' || node.type === 'NewExpression') uses.add(nameAt(node.callee));
      if (node.type === 'MemberExpression') uses.add(nameAt(node));
      if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' &&
          ['window', 'globalThis', 'self'].includes(node.left.object.name)) {
        provides.add(nameAt(node.left));
      }

      if (['ImportDeclaration', 'ExportAllDeclaration', 'ExportNamedDeclaration', 'ImportExpression']
        .includes(node.type) && node.source) {
        if (typeof node.source.value !== 'string') {
          throw new CheckError('A computed module path needs local runtime inspection.', 'not-testable');
        }
        requireEvidence(/^\.\.?\//.test(node.source.value), 'Frontend module import is not a relative browser path.');
        const imported = asset(owner, node.source.value);
        dependencies.add(imported);
        if (/\.[cm]?js$/i.test(imported)) inspectScript(imported, imported, readText(root, imported), true);
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(walk);
        else walk(value);
      }
    };
    walk(ast);
    uses.delete(undefined);
    provides.delete(undefined);
  };

  const textOf = node => (node.childNodes ?? []).map(child => child.value ?? '').join('');
  const visit = node => {
    const attrs = Object.fromEntries((node.attrs ?? []).map(a => [a.prefix ? `${a.prefix}:${a.name}` : a.name, a.value]));
    requireEvidence(!['base', 'iframe', 'object', 'embed'].includes(node.tagName) &&
      !(node.tagName === 'meta' && attrs['http-equiv']?.toLowerCase() === 'refresh'),
    'Frontend declares a separate browsing context, redirect or base URL.');
    const kind = attrs.type?.trim().toLowerCase();
    const isScript = node.tagName === 'script' &&
      (!kind || ['module', 'text/javascript', 'application/javascript'].includes(kind));

    for (const name of resourceAttrs[node.tagName] ?? []) {
      if (!(name in attrs) || (node.tagName === 'script' && !isScript) ||
          (node.tagName === 'link' && attrs.rel?.toLowerCase() === 'canonical')) continue;
      if (name === 'srcset') {
        if (/data:/i.test(attrs[name])) throw new CheckError('Inline srcset needs runtime inspection.', 'not-testable');
        for (const candidate of attrs[name].split(',')) asset(entry, candidate.trim().split(/\s/)[0]);
        continue;
      }
      const target = asset(entry, attrs[name], !isScript);
      if (isScript) {
        inspectScript(target, target, readText(root, target), kind === 'module');
        entryScripts.push(target);
      }
      if (target?.endsWith('.css') && !seenStyles.has(target)) {
        seenStyles.add(target);
        inspectCss(target, readText(root, target));
      }
    }
    if (isScript && !('src' in attrs) && textOf(node).trim()) {
      const id = `${entry}#inline-${entryScripts.length}`;
      inspectScript(id, entry, textOf(node), kind === 'module');
      entryScripts.push(id);
    }
    if (node.tagName === 'style') inspectCss(entry, textOf(node));
    if (attrs.style) inspectCss(entry, attrs.style);
    for (const [attribute, value] of Object.entries(attrs)) {
      if (!attribute.startsWith('on') || !value.trim()) continue;
      const id = `${entry}#event-${entryScripts.length}`;
      inspectScript(id, entry, `function eventHandler() {${value}\n}`, false);
      entryScripts.push(id);
    }
    node.childNodes?.forEach(visit);
  };
  visit(parse(readText(root, entry)));

  // Classic scripts use ordered globals rather than module imports when launched over file://.
  const classic = entryScripts.filter(id => !scripts.get(id).module && !id.includes('#event-'));
  const ordered = [...classic, ...entryScripts.filter(id => id.includes('#event-'))];
  for (const [index, id] of ordered.entries()) {
    for (const provider of classic.slice(0, index)) {
      if (id !== provider && [...scripts.get(id).uses].some(symbol => scripts.get(provider).provides.has(symbol))) {
        edges.get(id).add(provider);
      }
    }
  }

  const hasThreeTiers = entryScripts.some(ui => [...edges.get(ui)].some(logic =>
    !logic.includes('#') && [...(edges.get(logic) ?? [])].some(data =>
      !data.includes('#') && data !== logic && data !== ui)));
  return { resourceCount: files.size, hasThreeTiers };
}

async function observeOfflineStartup(root, executablePath) {
  if (!executablePath) throw new CheckError('No local Chromium executable was supplied.', 'not-testable');
  requireEvidence(path.isAbsolute(executablePath) && !/^[\\/]{2}/.test(executablePath) &&
    fs.statSync(executablePath, { throwIfNoEntry: false })?.isFile(),
  'Expected an absolute, local Chromium executable path.');
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ executablePath, chromiumSandbox: true, timeout: 30_000 });
  try {
    const context = await browser.newContext({ offline: true, serviceWorkers: 'block' });
    let denied = 0;
    let failures = 0;
    let scripts = 0;
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.protocol === 'data:') return route.continue();
      if (url.protocol === 'file:' && !url.host) {
        try {
          const file = fileURLToPath(url);
          const relative = path.relative(root, file).split(path.sep).join('/');
          requireEvidence(inside(root, file) && !installedTooling(relative),
            'Runtime resource is not a standalone output file.');
          localItem(root, relative);
          return route.continue();
        } catch (error) {
          if (!(error instanceof CheckError) && !(error instanceof URIError) && error.code !== 'ERR_INVALID_FILE_URL_PATH') throw error;
        }
      }
      denied++;
      return route.abort();
    });
    await context.routeWebSocket(/.*/, socket => {
      denied++;
      return socket.close();
    });
    const page = await context.newPage();
    page.on('requestfailed', () => failures++);
    page.on('pageerror', () => failures++);
    page.on('requestfinished', request => {
      if (request.resourceType() === 'script' && request.url().startsWith('file:')) scripts++;
    });
    const url = pathToFileURL(localItem(root, entry)).href;
    await page.goto(url, { waitUntil: 'load', timeout: 15_000 });
    const visible = await page.locator('body').evaluate(body =>
      body.getBoundingClientRect().height > 0 && body.innerText.trim().length > 0);
    requireEvidence(page.url() === url && visible && scripts > 0 && denied === 0 && failures === 0,
      'Offline startup did not produce a visible page and loaded local scripts without runtime or request failures.');
    return 'A fresh offline Chromium context loaded the file URL and local scripts with no observed startup errors.';
  } finally {
    await browser.close();
  }
}

module.exports = { inspectFrontend, observeOfflineStartup };
