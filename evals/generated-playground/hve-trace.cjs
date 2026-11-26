'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { CheckError, inside, localItem, playgroundDirectory, sha256 } = require('./local-files.cjs');
const { plugin, steps } = require('./hve-steps.cjs');

const maxTraceBytes = 8 * 1024 * 1024;
const questMarker = /^HVE-QUEST (0[1-9]|1[0-2])(?:\r?\n|$)/;
const eventId = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const token = value => typeof value === 'string' && value.trim() !== '' && value.length <= 256;
const rootEvent = event => !Object.hasOwn(event, 'agentId');

function need(condition, code) {
  if (!condition) throw new CheckError(code, 'not-run');
}

function loadTrace(workspace, tracePath) {
  need(typeof tracePath === 'string' && path.isAbsolute(tracePath) && !/^[\\/]{2}/.test(tracePath), 'trace-unavailable');
  const directory = playgroundDirectory(path.dirname(tracePath));
  need(!inside(workspace, directory), 'trace-must-be-held-outside-playground');
  const file = localItem(directory, path.basename(tracePath));
  const size = fs.statSync(file).size;
  need(size > 0 && size <= maxTraceBytes, 'trace-size-unsupported');
  const bytes = fs.readFileSync(file);
  need(bytes.length === size, 'trace-changed-during-read');
  const ids = new Set();
  const events = [];
  for (const line of bytes.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new CheckError('trace-jsonl-invalid', 'not-run');
    }
    need(entry && typeof entry === 'object' && !Array.isArray(entry), 'trace-envelope-invalid');
    if (entry.checkpoint === true || entry.ephemeral === true) continue;
    need(eventId(entry.id) && !ids.has(entry.id.toLowerCase()) && token(entry.type) &&
      entry.data && typeof entry.data === 'object' && !Array.isArray(entry.data) &&
      (rootEvent(entry) || token(entry.agentId)), 'trace-envelope-invalid');
    ids.add(entry.id.toLowerCase());
    events.push(entry);
  }
  return { events, digest: sha256(bytes) };
}

function scopedTurns(events, workspace, quest, ids) {
  const starts = events.filter(entry => entry.type === 'session.start' && rootEvent(entry));
  const sameCwd = cwd => typeof cwd === 'string' && path.isAbsolute(cwd) &&
    !/^[\\/]{2}/.test(cwd) && path.relative(workspace, cwd) === '';
  need(starts.length === 1 && events[0] === starts[0] && sameCwd(starts[0].data.context?.cwd),
    'trace-workspace-unbound');
  const users = events.flatMap((entry, index) => entry.type === 'user.message' && rootEvent(entry) ? [{ entry, index }] : []);
  const first = users.findIndex(({ entry }) => entry.id === ids[0]);
  need(first !== -1 && ids.every((id, offset) => users[first + offset]?.entry.id === id),
    'quest-entries-missing-or-not-contiguous');
  const turnIds = new Set();
  return ids.map((_, offset) => {
    const user = users[first + offset];
    const label = typeof user.entry.data.content === 'string' && questMarker.exec(user.entry.data.content)?.[1];
    need(offset === 0 ? label === quest : !label, 'quest-marker-mismatch');
    const turnId = user.entry.data.turnId;
    need(token(turnId) && !turnIds.has(turnId) && user.entry.data.delivery !== 'steering' &&
      user.entry.data.isAutopilotContinuation !== true, 'quest-turn-unbound');
    turnIds.add(turnId);
    const segment = events.slice(user.index + 1, users[first + offset + 1]?.index);
    const rootBoundaries = segment.flatMap((entry, index) =>
      rootEvent(entry) && ['assistant.turn_start', 'assistant.turn_end'].includes(entry.type) ? [{ entry, index }] : []);
    const [start, end] = rootBoundaries;
    need(rootBoundaries.length === 2 && start.entry.type === 'assistant.turn_start' &&
      end.entry.type === 'assistant.turn_end' && rootBoundaries.every(({ entry }) => entry.data.turnId === turnId),
    'quest-turn-incomplete-or-ambiguous');
    need(events.slice(0, user.index + end.index + 2).every(entry =>
      entry.type !== 'session.context_changed' || !rootEvent(entry) || sameCwd(entry.data.cwd)),
    'trace-workspace-changed');
    return { turnId, events: segment.slice(start.index + 1, end.index) };
  });
}

function invocation(target, { type, data }) {
  const model = data.model;
  const observedModel = typeof model === 'string' && /^[a-z0-9][a-z0-9._-]{0,95}$/i.test(model) &&
    !/^(?:unknown|unobserved)$/i.test(model) ? model : 'unobserved';
  return { target, eventType: type, observedModel };
}

function nativeOccurrences(turns) {
  const occurrences = [];
  for (const { turnId, events } of turns) {
    const launchCalls = new Map();
    const children = new Set();
    for (const entry of events) {
      const data = entry.data;
      if (entry.type === 'tool.execution_start' && rootEvent(entry) && data.turnId === turnId &&
          ['agent', 'task'].includes(data.toolName) && token(data.toolCallId) &&
          !['mcpConfigServerName', 'mcpServerName', 'mcpServerDisplayName', 'mcpToolName'].some(key => Object.hasOwn(data, key))) {
        const args = data.arguments;
        const selector = args?.agent_type ?? args?.subagent_type;
        const unambiguous = !(args?.agent_type && args?.subagent_type && args.agent_type !== args.subagent_type);
        if (typeof selector === 'string' && /^hve-core:[a-z0-9-]+$/.test(selector) && unambiguous) {
          launchCalls.set(data.toolCallId, launchCalls.has(data.toolCallId) ? null : selector);
        }
      } else if (entry.type === 'subagent.started' && !rootEvent(entry) && !children.has(entry.agentId)) {
        const target = launchCalls.get(data.toolCallId);
        if (target && target === data.agentName) {
          occurrences.push(invocation(`agent:${target.slice(plugin.name.length + 1)}`, entry));
          children.add(entry.agentId);
          launchCalls.delete(data.toolCallId);
        }
      } else if (entry.type === 'skill.invoked' && (rootEvent(entry) || children.has(entry.agentId)) &&
          data.trigger === 'agent-invoked' && data.pluginName === plugin.name &&
          data.pluginVersion === plugin.version && (data.source === undefined || data.source === 'plugin') &&
          typeof data.name === 'string') {
        occurrences.push(invocation(`skill:${data.name}`, entry));
      }
    }
  }
  return occurrences;
}

function checkNative(workspace, quest, tracePath, entries) {
  const definition = Object.hasOwn(steps, quest) ? steps[quest] : undefined;
  const expected = definition?.required.length ?? 0;
  const unobserved = { status: 'not-run', required: expected, observed: 0, conditionalObserved: 0, invocations: [] };
  if (!definition) return { ...unobserved, code: 'unknown-quest' };
  try {
    need(Array.isArray(entries) && entries.length > 0 && entries.length <= 32 &&
      entries.every(eventId) && new Set(entries).size === entries.length, 'quest-entry-ids-required');
    const { events, digest } = loadTrace(workspace, tracePath);
    const occurrences = nativeOccurrences(scopedTurns(events, workspace, quest, entries));
    let cursor = -1;
    const required = [];
    for (const target of definition.required) {
      const next = occurrences.findIndex((item, index) => index > cursor && item.target === target);
      if (next === -1) continue;
      required.push(occurrences[next]);
      cursor = next;
    }
    const conditional = (definition.conditional ?? [])
      .map(target => occurrences.find(item => item.target === target)).filter(Boolean);
    const observed = required.length;
    return {
      status: observed === expected ? 'observed' : 'not-run',
      code: observed === expected ? 'mapped-invocations-observed' : 'required-invocations-not-observed-in-order',
      required: expected, observed, conditionalObserved: conditional.length,
      invocations: [...required, ...conditional], traceSha256: digest
    };
  } catch (error) {
    if (error instanceof CheckError) return { ...unobserved, code: error.status === 'not-run' ? error.message : 'trace-unavailable' };
    if (['ENOENT', 'EACCES', 'EPERM', 'ENOTDIR'].includes(error.code)) return { ...unobserved, code: 'trace-unavailable' };
    return { ...unobserved, code: 'trace-checker-error' };
  }
}

module.exports = { checkNative };
