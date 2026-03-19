const DEFAULT_BRIDGE_BASE_URL = process.env.EMOBIT_BRIDGE_URL || 'http://127.0.0.1:4318';
const DEFAULT_ELDER_ID = process.env.EMOBIT_ELDER_ID || 'elder_demo';

export default function register(api) {
  const cfg = {
    bridgeBaseUrl: DEFAULT_BRIDGE_BASE_URL,
    bridgeToken: process.env.EMOBIT_BRIDGE_TOKEN || '',
    defaultElderId: DEFAULT_ELDER_ID,
    androidNodeId: '',
    ...(api.config || {}),
  };

  const bridgeGet = async (pathname, elderId = cfg.defaultElderId) => {
    const url = new URL(pathname, ensureSlash(cfg.bridgeBaseUrl));
    if (elderId) url.searchParams.set('elderId', elderId);
    const response = await fetch(url, {
      headers: buildBridgeHeaders(cfg),
    });
    if (!response.ok) {
      throw new Error(`Bridge GET ${url.pathname} failed with ${response.status}`);
    }
    return response.json();
  };

  const bridgePost = async (pathname, body) => {
    const url = new URL(pathname, ensureSlash(cfg.bridgeBaseUrl));
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildBridgeHeaders(cfg),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Bridge POST ${url.pathname} failed with ${response.status}: ${text}`);
    }
    return response.json();
  };

  api.registerGatewayMethod('emobit.status', ({ respond }) => {
    respond(true, {
      ok: true,
      bridgeBaseUrl: cfg.bridgeBaseUrl,
      defaultElderId: cfg.defaultElderId,
      androidNodeId: cfg.androidNodeId || null,
    });
  });

  api.registerTool({
    name: 'emobit_get_wandering_context',
    description: 'Get the latest wandering/geo-fence context, nearby memory anchors, and recent escalations for an elder.',
    parameters: {
      type: 'object',
      properties: {
        elderId: { type: 'string' }
      }
    },
    async execute(_id, params) {
      const result = await bridgeGet('/api/context/wandering', params.elderId);
      return asText(result.context);
    },
  });

  api.registerTool({
    name: 'emobit_get_medication_context',
    description: 'Get medication schedules, overdue doses, reminder state, and escalation hints for an elder.',
    parameters: {
      type: 'object',
      properties: {
        elderId: { type: 'string' }
      }
    },
    async execute(_id, params) {
      const result = await bridgeGet('/api/context/medication', params.elderId);
      return asText(result.context);
    },
  });

  api.registerTool({
    name: 'emobit_get_daily_report_context',
    description: 'Get the health, medication, cognition, and sundowning summary used to compose the daily guardian report.',
    parameters: {
      type: 'object',
      properties: {
        elderId: { type: 'string' }
      }
    },
    async execute(_id, params) {
      const result = await bridgeGet('/api/context/daily-report', params.elderId);
      return asText(result.context);
    },
  });

  api.registerTool({
    name: 'emobit_get_sundowning_context',
    description: 'Get the latest sundowning snapshot, interventions, and escalation hints for an elder.',
    parameters: {
      type: 'object',
      properties: {
        elderId: { type: 'string' }
      }
    },
    async execute(_id, params) {
      const result = await bridgeGet('/api/context/sundowning', params.elderId);
      return asText(result.context);
    },
  });

  api.registerTool({
    name: 'emobit_get_care_plan_context',
    description: 'Get structured reminders, follow-up appointments, hydration/sleep plans, and recent care-plan events.',
    parameters: {
      type: 'object',
      properties: {
        elderId: { type: 'string' }
      }
    },
    async execute(_id, params) {
      const result = await bridgeGet('/api/context/care-plan', params.elderId);
      return asText(result.context);
    },
  });

  api.registerTool({
    name: 'emobit_get_trends_context',
    description: 'Get 7-day cognition, medication, sundowning, face-recognition, and location-automation trend context.',
    parameters: {
      type: 'object',
      properties: {
        elderId: { type: 'string' }
      }
    },
    async execute(_id, params) {
      const result = await bridgeGet('/api/context/trends', params.elderId);
      return asText(result.context);
    },
  });

  api.registerTool({
    name: 'emobit_get_family_control_context',
    description: 'Get actionable frontend control suggestions and recent UI command history for family-driven avatar actions.',
    parameters: {
      type: 'object',
      properties: {
        elderId: { type: 'string' }
      }
    },
    async execute(_id, params) {
      const result = await bridgeGet('/api/context/family-control', params.elderId);
      return asText(result.context);
    },
  });

  api.registerTool({
    name: 'emobit_notify_guardians',
    description: 'Send a caregiver-facing notification through OpenClaw channels and record the outbound action.',
    parameters: {
      type: 'object',
      properties: {
        elderId: { type: 'string' },
        message: { type: 'string' },
        channel: { type: 'string' },
        purpose: { type: 'string' },
        targets: {
          type: 'array',
          items: { type: 'string' }
        },
        metadata: {
          type: 'object',
          additionalProperties: true
        }
      },
      required: ['message']
    },
    async execute(_id, params) {
      const result = await bridgePost('/api/outbound/notify-guardians', {
        elderId: params.elderId || cfg.defaultElderId,
        message: params.message,
        channel: params.channel,
        purpose: params.purpose || 'general',
        targets: params.targets,
        metadata: params.metadata || {},
      });
      return asText(result);
    },
  });

  api.registerTool({
    name: 'emobit_notify_elder',
    description: 'Send a short reassurance or reminder message to the elderly-side channel and record the outbound action.',
    parameters: {
      type: 'object',
      properties: {
        elderId: { type: 'string' },
        message: { type: 'string' },
        channel: { type: 'string' },
        target: { type: 'string' },
        purpose: { type: 'string' },
        metadata: {
          type: 'object',
          additionalProperties: true
        }
      },
      required: ['message']
    },
    async execute(_id, params) {
      const result = await bridgePost('/api/outbound/notify-elder', {
        elderId: params.elderId || cfg.defaultElderId,
        message: params.message,
        channel: params.channel,
        target: params.target,
        purpose: params.purpose || 'general',
        metadata: params.metadata || {},
      });
      return asText(result);
    },
  });

  api.registerTool({
    name: 'emobit_place_guardian_call',
    description: 'Place an outbound voice call to the guardian when the escalation policy requires it.',
    parameters: {
      type: 'object',
      properties: {
        elderId: { type: 'string' },
        to: { type: 'string' },
        message: { type: 'string' },
        mode: { type: 'string' },
        purpose: { type: 'string' },
        metadata: {
          type: 'object',
          additionalProperties: true
        }
      },
      required: ['message']
    },
    async execute(_id, params) {
      const result = await bridgePost('/api/outbound/voice-call', {
        elderId: params.elderId || cfg.defaultElderId,
        to: params.to,
        message: params.message,
        mode: params.mode || 'notify',
        purpose: params.purpose || 'voice_call',
        metadata: params.metadata || {},
      });
      return asText(result);
    },
  });

  api.registerTool({
    name: 'emobit_ui_command',
    description: 'Write UI commands back to EmoBit bridge so the web demo can reflect OpenClaw decisions (status/log/navigation).',
    parameters: {
      type: 'object',
      properties: {
        elderId: { type: 'string' },
        type: { type: 'string' },
        payload: {
          type: 'object',
          additionalProperties: true,
        },
      },
      required: ['type'],
    },
    async execute(_id, params) {
      const result = await bridgePost('/api/ui/commands', {
        elderId: params.elderId || cfg.defaultElderId,
        command: {
          type: params.type,
          payload: params.payload || {},
        },
      });
      return asText(result);
    },
  });

  api.registerTool({
    name: 'emobit_control_elder_frontend',
    description: 'Trigger a frontend action on the elderly-side avatar, such as speaking a line, opening the album, showing medication, or starting breathing guidance.',
    parameters: {
      type: 'object',
      properties: {
        elderId: { type: 'string' },
        action: { type: 'string' },
        purpose: { type: 'string' },
        payload: {
          type: 'object',
          additionalProperties: true,
        },
      },
      required: ['action'],
    },
    async execute(_id, params) {
      const result = await bridgePost('/api/outbound/elder-action', {
        elderId: params.elderId || cfg.defaultElderId,
        action: params.action,
        purpose: params.purpose || 'family_control',
        payload: params.payload || {},
      });
      return asText(result);
    },
  });
}

function buildBridgeHeaders(cfg) {
  return cfg.bridgeToken ? { 'x-emobit-bridge-token': cfg.bridgeToken } : {};
}

function ensureSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function asText(value) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}
