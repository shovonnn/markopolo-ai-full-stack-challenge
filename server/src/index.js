import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';
import { ShopifyAdapter } from './adapters/ShopifyAdapter.js';
import { WebsiteAdapter } from './adapters/WebsiteAdapter.js';
import { FacebookPageAdapter } from './adapters/FacebookPageAdapter.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5174;

// Adapter registry and in-memory connection state
const adapters = [new ShopifyAdapter(), new WebsiteAdapter(), new FacebookPageAdapter()];
const connectionState = /** @type {Record<string, any>} */ ({}); // keyed by adapter.id

// App-level selection state (channels + derived data source names)
const connections = {
  dataSources: [],
  channels: []
};

app.get('/health', (_, res) => res.json({ ok: true }));

// List available adapters and their connection status
app.get('/adapters', (_req, res) => {
  res.json({ ok: true, adapters: adapters.map(a => a.getStatus(connectionState[a.id])) });
});

// Connect an adapter (mock auth)
app.post('/adapters/:id/connect', async (req, res) => {
  const id = req.params.id;
  const adapter = adapters.find(a => a.id === id);
  if (!adapter) return res.status(404).json({ ok: false, error: 'Adapter not found' });
  try {
    const next = await adapter.connect(req.body, connectionState[id]);
    connectionState[id] = { ...(connectionState[id] || {}), ...next };
    syncDataSourcesFromState();
    res.json({ ok: true, status: adapter.getStatus(connectionState[id]) });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
});

// Disconnect an adapter
app.post('/adapters/:id/disconnect', async (req, res) => {
  const id = req.params.id;
  const adapter = adapters.find(a => a.id === id);
  if (!adapter) return res.status(404).json({ ok: false, error: 'Adapter not found' });
  try {
    const next = await adapter.disconnect(connectionState[id]);
    connectionState[id] = { ...(connectionState[id] || {}), ...next };
    syncDataSourcesFromState();
    res.json({ ok: true, status: adapter.getStatus(connectionState[id]) });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
});

// Connect channels (data sources are driven by adapters)
app.post('/connect', (req, res) => {
  const { channels = [] } = req.body || {};
  const allowedChannels = new Set(['Email', 'SMS', 'WhatsApp', 'Ads']);
  const selectedChannels = [...new Set(channels)].filter(c => allowedChannels.has(c)).slice(0, 4);
  connections.channels = selectedChannels;
  syncDataSourcesFromState();
  res.json({ ok: true, dataSources: connections.dataSources, channels: selectedChannels });
});

// Stream structured decision frames (SSE): steps 1-4, then final executable spec
app.get('/stream-campaign', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const decisionId = nanoid(10);
  const start = Date.now();

  const now = new Date();
  const audiences = deriveAudiences(connections.dataSources);
  const connectedAdapters = adapters.filter(a => connectionState[a.id]?.connected);
  const adapterSnapshots = await Promise.all(
    connectedAdapters.map(async (a) => {
      const snap = await a.fetchSnapshot(connectionState[a.id]);
      return { id: a.id, name: a.name, icon: a.icon, signals: snap?.signals || {} };
    })
  );
  const governance = {
    frequencyCaps: { perUserPerDay: 2 },
    quietHours: { start: '21:00', end: '08:00', timezone: 'local' },
    optOutRespect: true
  };
  const kpis = [
    { name: 'CTR', target: 0.045 },
    { name: 'CVR', target: 0.032 },
    { name: 'Revenue', target: 15000 }
  ];

  const send = (eventName, obj) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  // Step 1 — Context & audience
  setTimeout(() => {
    send('step', {
      decision_id: decisionId,
      step: 1,
      name: 'context_audience',
      payload: {
        dataSources: connections.dataSources,
        adapterSnapshots,
        audiences: audiences.map(a => ({
          segmentId: `seg_${a.key}`,
          key: a.key,
          description: a.description,
          size: a.size,
          criteria: a.criteria
        })),
        consent: {
          sms_opt_in_required: true,
          whatsapp_template_approval_required: true
        },
        kpis,
        guardrails: governance
      }
    });
  }, 100);

  // Step 2 — Right time
  setTimeout(() => {
    const timing = audiences.map(a => {
      const win = rightTimeWindow('Email', a, Date.now());
      return {
        audienceKey: a.key,
        window: win,
        recommended_send_at: win.start,
        timezone: win.timezone,
        confidence: 0.78,
        constraints: { quietHours: governance.quietHours, frequencyCaps: governance.frequencyCaps }
      };
    });
    send('step', {
      decision_id: decisionId,
      step: 2,
      name: 'right_time',
      payload: { timing }
    });
  }, 400);

  // Step 3 — Right channel
  setTimeout(() => {
    const ranked = rankChannels(connections.channels, audiences);
    send('step', {
      decision_id: decisionId,
      step: 3,
      name: 'right_channel',
      payload: { ranked }
    });
  }, 750);

  // Step 4 — Right message
  setTimeout(() => {
    const candidates = [];
    for (const ch of connections.channels) {
      for (const a of audiences) {
        candidates.push({
          channel: ch,
          audienceKey: a.key,
          content: rightMessage(ch, a),
          variables: { first_name: '{{first_name}}', last_order_total: '{{last_order_total}}' },
          complianceChecks: { brand_safety: 'pass', pii_scan: 'pass' }
        });
      }
    }
    send('step', {
      decision_id: decisionId,
      step: 4,
      name: 'right_message',
      payload: { candidates }
    });
  }, 1100);

  // Step 5 — Final executable (emit a summary step first, then full final payload)
  setTimeout(() => {
    const spec = buildCampaign(connections);
    const channelsSet = [...new Set(spec.orchestration.map(o => o.channel))];
    // Emit as a regular step for UI progress and visibility
    send('step', {
      decision_id: decisionId,
      step: 5,
      name: 'final_executable',
      payload: { summary: { actions: spec.orchestration.length, channels: channelsSet } }
    });
    // Emit the full final payload
    send('final', {
      decision_id: decisionId,
      step: 5,
      name: 'final_executable',
      payload: spec
    });
    // Slightly delay end to ensure client processes 'final'
    setTimeout(() => {
      send('end', { decision_id: decisionId, durationMs: Date.now() - start });
      res.end();
    }, 50);
  }, 1500);

  req.on('close', () => res.end());
});

// Accept a launch request with the final campaign JSON
app.post('/launch', (req, res) => {
  try {
    const payload = req.body;
    const orchestration = Array.isArray(payload?.orchestration) ? payload.orchestration : [];
    const channels = [...new Set(orchestration.map(o => o.channel))];
    res.json({ ok: true, campaignId: payload?.id ?? null, actions: orchestration.length, channels });
  } catch (e) {
    res.status(400).json({ ok: false, error: 'Invalid campaign payload' });
  }
});

function buildCampaign({ dataSources = [], channels = [] }) {
  const now = new Date();
  const campaignId = nanoid(8);

  const audiences = deriveAudiences(dataSources);
  const channelPlans = deriveChannelPlans(channels, audiences);

  return {
    id: campaignId,
    generatedAt: now.toISOString(),
    horizon: {
      start: now.toISOString(),
      end: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString() // +7 days
    },
    objective: "Drive repeat purchases and re-engage lapsed users",
    strategy: "Right time, right channel, right message, right audience",
    dataSources,
    channels,
    audiences,
    orchestration: channelPlans,
    kpis: [
      { name: 'CTR', target: 0.045 },
      { name: 'CVR', target: 0.032 },
      { name: 'Revenue', target: 15000 }
    ],
    governance: {
      frequencyCaps: { perUserPerDay: 2 },
      quietHours: { start: '21:00', end: '08:00', timezone: 'local' },
      optOutRespect: true
    }
  };
}

function deriveAudiences(sources) {
  // Estimate audience size from available sources and a base factor
  function estimateSize(srcs, factor) {
    const base = 10000; // base population for demo purposes
    const multiplier = (srcs?.length || 0) > 0 ? 1 + srcs.length * 0.3 : 0.8;
    const noise = 0.9 + Math.random() * 0.2; // +/-10%
    return Math.max(100, Math.round(base * factor * multiplier * noise));
  }

  const base = [
    {
      key: 'recent_buyers',
      description: 'Users who purchased in last 30 days',
      size: estimateSize(sources, 0.18),
      criteria: [
        { source: 'Shopify', field: 'last_order_date', op: '>=', value: 'now-30d' }
      ]
    },
    {
      key: 'cart_abandoners',
      description: 'Users abandoned cart in last 7 days',
      size: estimateSize(sources, 0.12),
      criteria: [
        { source: 'Website', field: 'cart_abandoned', op: '==', value: true }
      ]
    },
    {
      key: 'high_intent_social',
      description: 'High engagement on Facebook page last 14 days',
      size: estimateSize(sources, 0.08),
      criteria: [
        { source: 'Facebook Page', field: 'engagement_score', op: '>=', value: 70 }
      ]
    }
  ];
  return base.filter(a => a.criteria.every(c => sources.includes(c.source)));
}

function deriveChannelPlans(channels, audiences) {
  const plans = [];
  const now = Date.now();

  for (const ch of channels) {
    for (const audience of audiences) {
      plans.push({
        channel: ch,
        audienceKey: audience.key,
        schedule: rightTimeWindow(ch, audience, now),
        message: rightMessage(ch, audience),
        tracking: {
          utm: {
            source: ch.toLowerCase(),
            campaign: `cmp_${audience.key}`,
            medium: 'owned'
          }
        },
        delivery: {
          retries: ch === 'SMS' ? 1 : 0,
          dedupeWindowMins: 60
        }
      });
    }
  }
  return plans;
}

function rankChannels(channels, audiences) {
  // Produce simple ranked list per audience with mock scores and reasons
  const out = [];
  for (const a of audiences) {
    const scored = channels.map(c => ({
      audienceKey: a.key,
      channel: c,
      score: Math.round((0.6 + Math.random() * 0.4) * 100) / 100,
      eligible: !(c === 'SMS' && Math.random() < 0.1),
      reason: c === 'SMS' ? 'Requires explicit SMS opt-in' : 'Reach and engagement predicted high'
    })).sort((x, y) => y.score - x.score);
    out.push({ audienceKey: a.key, ranking: scored, fallback: scored.slice(1, 3).map(s => s.channel) });
  }
  return out;
}

function rightTimeWindow(channel, audience, nowTs) {
  const offset = audience.key.includes('cart') ? 60 * 60 * 1000 : 12 * 60 * 60 * 1000; // 1h vs 12h
  const start = new Date(nowTs + offset);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString(), timezone: 'local' };
}

function rightMessage(channel, audience) {
  const base = {
    Email: {
      subject: audience.key === 'cart_abandoners' ? 'Still thinking it over? Your cart awaits' : 'Just for you',
      body: audience.key === 'recent_buyers'
        ? 'Thank you for your recent purchase! Here is 10% off on accessories.'
        : 'We picked these just for you—come take a look.'
    },
    SMS: {
      text: audience.key === 'cart_abandoners' ? 'You left something behind 🛒. Use SAVE10 in the next 24h.' : 'New drops you might like. Tap to see.'
    },
    WhatsApp: {
      text: audience.key === 'high_intent_social' ? 'Loved your engagement! Here’s early access 🔓' : 'Exclusive offers just for you.'
    },
    Ads: {
      headline: 'Recommended for you',
      description: audience.key === 'recent_buyers' ? 'Bundle up and save on your next order.' : 'Back in stock—grab yours now.'
    }
  };
  return base[channel];
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

function syncDataSourcesFromState() {
  const idToName = {
    shopify: 'Shopify',
    website: 'Website',
    facebook_page: 'Facebook Page'
  };
  const connected = Object.entries(connectionState)
    .filter(([, v]) => v?.connected)
    .map(([k]) => idToName[k] || k);
  connections.dataSources = connected.slice(0, 3);
}
