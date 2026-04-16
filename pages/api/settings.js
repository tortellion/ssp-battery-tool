import { createServerClient } from '../../lib/supabase';

const DEFAULT_SETTINGS = { margin_percent: 40, labor_rate: 75, base_hours: 2, per_cell_hours: 0.5 };

export default async function handler(req, res) {
  const supabase = createServerClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data } = await supabase
      .from('user_settings')
      .select('data')
      .eq('user_id', session.user.id)
      .single();
    return res.json(data?.data || DEFAULT_SETTINGS);
  }

  if (req.method === 'PUT') {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'Invalid settings' });
    const safe = {
      ...settings,
      margin_percent: Math.min(99, Math.max(0, Number(settings.margin_percent) || 0)),
    };
    const { error } = await supabase.from('user_settings').upsert({ user_id: session.user.id, data: safe });
    if (error) return res.status(500).json({ error: 'Failed to save settings' });
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
