import { createServerClient } from '../../lib/supabase';
import { DEMO_LIBRARY } from '../../lib/demoLibrary';
import { CONFIG_SYSTEM_PROMPT, validateConfigResponse, nm } from '../../lib/guardrails';

// H-3: phrases that must not reach the model from user input
const INJECTION_PHRASES = [
  'ignore previous instructions', 'ignore all instructions', 'disregard',
  'new instruction', 'system:', 'you are now', 'forget your instructions',
  'override', 'jailbreak',
];

function serverSanitize(value) {
  if (typeof value !== 'string') return value;
  const normalized = nm(value);
  if (INJECTION_PHRASES.some(p => normalized.includes(p))) return '[Input sanitized]';
  return value;
}

// H-3: only return the keys the schema defines — never leak extra model output
const ALLOWED_RESPONSE_KEYS = ['viable', 'rejected_reasons', 'configurations'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Auth check
  const supabase = createServerClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { payload } = req.body;
  if (!payload) return res.status(400).json({ error: 'Missing payload' });

  // H-3: sanitize all user-supplied string fields server-side before sending to model
  const safePayload = {
    ...payload,
    company:     serverSanitize(payload.company),
    product:     serverSanitize(payload.product),
    application: serverSanitize(payload.application),
    vertical:    serverSanitize(payload.vertical),
  };

  // H-2: fetch canonical library server-side; never trust client-supplied library
  const { data: libRow, error: libErr } = await supabase
    .from('component_library')
    .select('data')
    .limit(1)
    .single();
  if (libErr && libErr.code !== 'PGRST116') {
    return res.status(503).json({ error: 'Component library unavailable' });
  }
  const library = libRow?.data ?? DEMO_LIBRARY;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: CONFIG_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify({ requirements: safePayload, library, design_rules: library.design_rules }) }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `Anthropic API error: ${err.slice(0, 200)}` });
    }

    const data = await response.json();
    const raw = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(clean);

    const validation = validateConfigResponse(parsed);
    if (!validation.valid) {
      return res.status(422).json({ error: 'Invalid engine response', details: validation.errors });
    }

    // H-3: whitelist response keys — never return extra fields the model may have added
    const safe = Object.fromEntries(ALLOWED_RESPONSE_KEYS.map(k => [k, parsed[k]]));
    return res.json(safe);
  } catch (err) {
    console.error('Configure error:', err);
    return res.status(500).json({ error: 'Configuration engine unavailable. Check your connection.' });
  }
}
