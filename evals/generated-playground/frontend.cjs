'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const acorn = require('acorn');
const { analyze } = require('eslint-scope');
const { parse } = require('parse5');
const { CheckError, requireEvidence, inside, localItem, readText } = require('./local-files.cjs');

const entry = 'app/web/index.html';
const resourceAttrs = {
  script: ['src'], link: ['href'], img: ['src', 'srcset'], source: ['src', 'srcset'],
  audio: ['src'], video: ['src', 'poster'], track: ['src'], input: ['src'],
  image: ['href', 'xlink:href'], use: ['href', 'xlink:href']
};
const installedTooling = relative => relative.split('/').some(part => part.toLowerCase() === 'node_modules');
const browserGlobals = new Set(['window', 'globalThis', 'self']);
const functionValue = node => ['FunctionExpression', 'ArrowFunctionExpression'].includes(node?.type);

function walkChildren(node, visit) {
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else visit(value);
  }
}

function staticReference(reference) {
  if (!reference || reference.tainted) return false;
  for (let scope = reference.from; scope; scope = scope.upper) {
    if (scope.type === 'with' || scope.directCallToEvalScope) return false;
  }
  return true;
}

function scriptBindings(ast) {
  const scopeManager = analyze(ast, { sourceType: ast.sourceType, ecmaVersion: 2025, optimistic: true });
  const references = new WeakMap();
  const overwrittenGlobals = new Set();
  const origins = new Map();
  const browserAliases = new Set();
  for (const scope of scopeManager.scopes) {
    for (const reference of scope.references) {
      references.set(reference.identifier, reference);
      if (!reference.resolved && reference.isWrite()) overwrittenGlobals.add(reference.identifier.name);
    }
  }

  function stableDeclaration(node, identifier) {
    if (identifier?.type !== 'Identifier') return;
    const binding = scopeManager.getDeclaredVariables(node).find(variable => variable.identifiers.includes(identifier));
    if (binding?.identifiers.length === 1 && !binding.references.some(reference => reference.isWrite() && !reference.init)) {
      return binding;
    }
  }

  function browserReceiver(node) {
    if (node?.type === 'ThisExpression') return true;
    if (node?.type === 'ConditionalExpression') return browserReceiver(node.consequent) && browserReceiver(node.alternate);
    const reference = references.get(node);
    if (!staticReference(reference)) return false;
    return reference.resolved ? browserAliases.has(reference.resolved)
      : browserGlobals.has(node.name) && !overwrittenGlobals.has(node.name);
  }

  function globalProperty(node) {
    if (node?.type !== 'MemberExpression' || node.object.type !== 'Identifier' || !browserReceiver(node.object)) return;
    const key = node.computed ? node.property.value : node.property.name;
    return typeof key === 'string' ? key : undefined;
  }

  function originOf(node) {
    if (node?.type === 'Identifier') {
      const reference = references.get(node);
      if (!staticReference(reference)) return;
      if (reference.resolved) return origins.get(reference.resolved);
      // Only the graph can match an unresolved identifier to a unique earlier classic script export.
      if (!browserGlobals.has(node.name) && !overwrittenGlobals.has(node.name)) return node.name;
    }
    if (node?.type === 'MemberExpression') return globalProperty(node) ?? originOf(node.object);
    if (['CallExpression', 'NewExpression'].includes(node?.type)) return originOf(node.callee);
  }

  return { scopeManager, stableDeclaration, browserReceiver, globalProperty, originOf, origins, browserAliases };
}

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

  const inspectScript = (id, owner, source, module) => {
    if (scripts.has(id)) return;
    let ast;
    try {
      ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: module ? 'module' : 'script', ranges: true });
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new CheckError('A runnable browser script has invalid JavaScript syntax.');
    }
    const provides = new Set();
    const uses = new Set();
    const dependencies = new Set();
    const injections = [];
    scripts.set(id, { provides, uses, module, injections });
    edges.set(id, dependencies);

    const { scopeManager, stableDeclaration, browserReceiver, globalProperty, originOf, origins, browserAliases } = scriptBindings(ast);
    for (const statement of ast.body) {
      for (const declaration of scopeManager.getDeclaredVariables(statement)) {
        if (declaration.scope === scopeManager.globalScope) provides.add(declaration.name);
      }
    }
    // A classic script can publish its API through an IIFE's global-object parameter.
    const wrappers = new Set(module ? [] : ast.body.map(statement => statement.expression)
      .filter(node => node?.type === 'CallExpression' && functionValue(node.callee)));
    const walk = node => {
      if (!node || typeof node.type !== 'string') return;
      if (wrappers.has(node)) {
        node.callee.params.forEach((param, index) => {
          const binding = stableDeclaration(node.callee, param);
          if (binding && browserReceiver(node.arguments[index])) browserAliases.add(binding);
        });
      }
      if (node.type === 'CallExpression' || node.type === 'NewExpression') {
        const application = originOf(node.callee);
        uses.add(application);
        if (application) {
          for (const arg of node.arguments) {
            const values = arg.type === 'ObjectExpression'
              ? arg.properties.filter(property => property.type === 'Property' && property.kind === 'init').map(property => property.value)
              : [arg];
            for (const value of values) {
              const data = originOf(value);
              if (data && data !== application) injections.push([application, data]);
            }
          }
        }
      }
      if (node.type === 'MemberExpression') uses.add(originOf(node));
      if (node.type === 'AssignmentExpression') provides.add(globalProperty(node.left));

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
      walkChildren(node, walk);
      if (node.type === 'VariableDeclarator') {
        const binding = stableDeclaration(node, node.id);
        const origin = originOf(node.init);
        if (binding && origin !== undefined) origins.set(binding, origin);
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
  let hasInjectedDependency = false;
  for (const [index, id] of ordered.entries()) {
    const prior = classic.slice(0, index).filter(provider => provider !== id);
    const { uses, injections } = scripts.get(id);
    for (const provider of prior) {
      if ([...uses].some(symbol => scripts.get(provider).provides.has(symbol))) {
        edges.get(id).add(provider);
      }
    }
    // Loading two scripts as siblings is insufficient: one export must be passed to the other.
    const providerOf = name => {
      const candidates = prior.filter(provider => !provider.includes('#') && scripts.get(provider).provides.has(name));
      return candidates.length === 1 ? candidates[0] : undefined;
    };
    hasInjectedDependency ||= injections.some(([application, data]) => {
      const logic = providerOf(application);
      const storage = providerOf(data);
      return logic && storage && logic !== storage;
    });
  }

  const hasThreeTiers = hasInjectedDependency || entryScripts.some(ui => [...edges.get(ui)].some(logic =>
    !logic.includes('#') && [...(edges.get(logic) ?? [])].some(data =>
      !data.includes('#') && data !== logic && data !== ui)));
  return { resourceCount: files.size, hasThreeTiers };
}

async function observeOfflineStartup(root, executablePath) {
  if (!executablePath) throw new CheckError('No local Chromium executable was supplied.', 'not-run');
  if (!path.isAbsolute(executablePath) || /^[\\/]{2}/.test(executablePath) ||
      !fs.statSync(executablePath, { throwIfNoEntry: false })?.isFile()) {
    throw new CheckError('Expected an absolute, local Chromium executable path.', 'not-run');
  }
  try {
    inspectFrontend(root);
  } catch (error) {
    if (!(error instanceof CheckError)) throw error;
    throw new CheckError('Static resource checks blocked opening the page.', 'not-run');
  }
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
    page.on('console', message => {
      if (message.type() === 'error') failures++;
    });
    page.on('requestfinished', request => {
      if (request.resourceType() === 'script' && request.url().startsWith('file:')) scripts++;
    });
    const url = pathToFileURL(localItem(root, entry)).href;
    await page.goto(url, { waitUntil: 'load', timeout: 15_000 });
    const visible = await page.locator('body').evaluate(body =>
      body.getBoundingClientRect().height > 0 && body.innerText.trim().length > 0);
    requireEvidence(page.url() === url && visible && scripts > 0 && denied === 0 && failures === 0,
      'Offline startup did not produce a visible page and loaded local scripts without runtime or request failures.');
    await page.keyboard.press('Tab');
    const focusable = await page.locator(':focus').evaluateAll(elements => elements.some(element =>
      element !== document.body && element !== document.documentElement && element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility === 'visible'));
    requireEvidence(focusable, 'Tab did not reach a visible focus target in the offline frontend.');
    requireEvidence(denied === 0 && failures === 0, 'Keyboard startup produced runtime or request failures.');
    return 'Offline Chromium loaded the file URL and local scripts, and Tab reached a visible focus target without observed startup errors.';
  } finally {
    await browser.close();
  }
}

module.exports = { inspectFrontend, observeOfflineStartup };
