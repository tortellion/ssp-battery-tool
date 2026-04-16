import { createServerClient } from '../../lib/supabase';
import { CONFIG_SYSTEM_PROMPT, validateConfigResponse } from '../../lib/guardrails';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Auth check
  const supabase = createServerClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { payload, library, design_rules } = req.body;
  if (!payload || !library) return res.status(400).json({ error: 'Missing payload or library' });

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
        messages: [{ role: 'user', content: JSON.stringify({ requirements: payload, library, design_rules }) }]
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

    return res.json(parsed);
  } catch (err) {
    console.error('Configure error:', err);
    return res.status(500).json({ error: 'Configuration engine unavailable. Check your connection.' });
  }
}
