'use strict';

const purpose = 'workshop-instruction-evaluation';
const source = 'procedural-instructions';

function hasKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function pinned(route) {
  if (!hasKeys(route, ['model', 'service', 'selection', 'fallback']) ||
      route.selection !== 'pinned' || route.fallback !== 'none') return false;
  return [route.model, route.service].every(id => typeof id === 'string' && /^[a-z0-9][a-z0-9._-]*$/i.test(id) &&
    !/^(auto|default|unknown|unverified)$/i.test(id));
}

// Comparison only. Trusted authority would have to come from outside the request;
// this repository has no adapter that can attest the SDK's actual execution route.
function evaluationBlock(request, trustedRecord) {
  if (!trustedRecord) return 'No trusted execution record binds the effective model, service and fallback.';
  for (const metadata of [request, trustedRecord]) {
    if (!hasKeys(metadata, ['purpose', 'inputMode', 'source', 'audience', 'route']) ||
        metadata.purpose !== purpose || metadata.inputMode !== 'unseeded' ||
        metadata.source !== source || metadata.audience !== 'local') {
      return 'Only local evaluation of unseeded procedural instructions is in scope.';
    }
    if (!pinned(metadata.route)) return 'The effective route must be pinned with fallback disabled.';
  }
  if (request.route.model !== trustedRecord.route.model || request.route.service !== trustedRecord.route.service) {
    return 'The effective model or service does not match the trusted record.';
  }
  return null;
}

if (require.main === module) {
  const request = { purpose, inputMode: 'unseeded', source, audience: 'local', route: null };
  // No input from argv, environment, files or sign-in; no SDK import or live runner.
  const reason = evaluationBlock(request, null);
  console.error(`Live evaluation is disabled. ${reason} Use npm run eval:lint for the static suite.`);
  process.exitCode = 1;
}

module.exports = { evaluationBlock };
