import { createServerClient } from '../../lib/supabase';
import { DEMO_LIBRARY } from '../../lib/demoLibrary';

export default async function handler(req, res) {
  const supabase = createServerClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  // GET — return the shared library (or demo if none exists)
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('component_library')
      .select('data, is_demo, updated_at, updated_by')
      .limit(1)
      .single();

    if (error || !data) {
      return res.json({ library: DEMO_LIBRARY, is_demo: true });
    }
    return res.json({ library: data.data, is_demo: data.is_demo, updated_at: data.updated_at });
  }

  // PUT — save updated library
  if (req.method === 'PUT') {
    const { library, is_demo = false } = req.body;
    if (!library) return res.status(400).json({ error: 'Missing library' });

    // Upsert — there's only ever one row (enforced by unique index on TRUE)
    const { error } = await supabase
      .from('component_library')
      .upsert({
        data: library,
        is_demo,
        updated_by: session.user.id,
        updated_at: new Date().toISOString()
      });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
