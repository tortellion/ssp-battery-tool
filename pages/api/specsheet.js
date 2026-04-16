import { createServerClient } from '../../lib/supabase';
import { SPEC_SYSTEM_PROMPT, validateSpecSheet } from '../../lib/guardrails';
import { checkRateLimit } from '../../lib/rateLimiter';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const supabase = createServerClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  // H-1: per-user rate limit — 20 requests/60s
  const rl = checkRateLimit(session.user.id);
  if (!rl.allowed) {
    res.setHeader('Retry-After', rl.retryAfter);
    return res.status(429).json({ error: 'Rate limit exceeded. Try again shortly.' });
  }

  const { configuration, customerInfo } = req.body;
  if (!configuration || !customerInfo) return res.status(400).json({ error: 'Missing fields' });

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
        system: SPEC_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify({ configuration, customer: customerInfo }) }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `Anthropic API error: ${err.slice(0, 200)}` });
    }

    const data = await response.json();
    const raw = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const content = JSON.parse(clean);

    // Validate guardrails server-side before returning
    const validation = validateSpecSheet(content);
    if (!validation.ok) {
      return res.status(422).json({ error: 'Guardrail validation failed', violations: validation.violations });
    }

    return res.json(content);
  } catch (err) {
    console.error('Specsheet error:', err);
    return res.status(500).json({ error: 'Spec sheet engine unavailable.' });
  }
}
