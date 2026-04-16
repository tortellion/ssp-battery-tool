import { createServerClient } from '../../lib/supabase';
import { validateSpecSheet } from '../../lib/guardrails';

export default async function handler(req, res) {
  const supabase = createServerClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  // GET — return recent configurations (shared across team)
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('configurations')
      .select('id, company, product, vertical, voltage, capacity_wh, spec_content, cfg_summary, created_at, user_id, user_email')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  // POST — save a new configuration result
  if (req.method === 'POST') {
    const { company, product, vertical, voltage, capacity_wh, spec_content, cfg_summary } = req.body;

    // H-4: reject spec_content that fails guardrail validation
    if (spec_content) {
      const check = validateSpecSheet(spec_content);
      if (!check.ok) {
        return res.status(422).json({ error: 'Spec sheet failed guardrail validation', violations: check.violations });
      }
    }

    const { data, error } = await supabase
      .from('configurations')
      .insert({
        user_id: session.user.id,
        user_email: session.user.email,
        company, product, vertical, voltage, capacity_wh,
        spec_content, cfg_summary
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  return res.status(405).end();
}
