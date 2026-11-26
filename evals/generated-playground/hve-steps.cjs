'use strict';

const plugin = { name: 'hve-core', version: '3.2.2' };
const steps = {
  '01': { required: ['skill:documentation'] },
  '02': { required: ['skill:rpi-research'] },
  '03': { required: ['agent:dt-coach', 'skill:ux-artifacts'] },
  '04': { required: ['agent:brd-builder', 'agent:prd-builder'] },
  '05': { required: ['skill:functional-planner'] },
  '06': { required: ['agent:system-architecture-reviewer', 'skill:adr-author'] },
  '07': { required: ['skill:root-cause-analysis'] },
  '08': { required: ['skill:security-planning'] },
  '09': { required: ['agent:sssc-planner'] },
  '10': { required: ['agent:accessibility-planner', 'agent:privacy-planner'] },
  '11': { required: ['agent:rai-planner'], conditional: ['agent:experiment-designer'] },
  '12': { required: ['skill:rpi-research', 'skill:rpi-plan', 'skill:rpi-implement', 'skill:rpi-review'] }
};

const models = {
  google: [['gemini-4-neon', 'xhigh', 'long_context'], ['gemini-4-carbon', 'medium']],
  anthropic: [['claude-opus-5.5', 'max', 'long_context'], ['claude-sonnet-5.5', 'medium']],
  openai: [['gpt-6.2-sol', 'max', 'long_context'], ['gpt-6.1-terra', 'medium']],
  microsoft: [['mai-code-2', 'max', 'default'], ['mai-code-2-flash', 'medium']],
  fusion: [['auto', 'unspecified', 'unspecified', 'hydrafusion-max'], ['auto', 'medium', 'unspecified', 'Balance']]
};

function profile(provider) {
  if (!Object.hasOwn(models, provider)) return null;
  const setting = ([model, effort, context = 'unspecified', tier]) => ({
    model, effort, context, route: 'unspecified', ...(tier && { tier })
  });
  const [generation, questAgent] = models[provider].map(setting);
  const unobserved = { model: 'unobserved', effort: 'unobserved', context: 'unobserved', route: 'unobserved' };
  return {
    requested: { generation, questAgent },
    observed: { generation: unobserved, questAgent: unobserved }
  };
}

module.exports = { plugin, steps, profile };
