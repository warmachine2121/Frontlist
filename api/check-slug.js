// GET /api/check-slug?slug=<slug>&project_id=<optional>
// Returns { available: boolean, reason?: string }
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const slug = (req.query.slug || '').trim();
    const ignoreProjectId = req.query.project_id || null;
    if (!slug) return res.status(400).json({ available: false, reason: 'Missing slug' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return res.status(500).json({ available: false, reason: 'Server not configured' });

    const sCheck = await fetch(`${supabaseUrl}/rest/v1/projects?slug=eq.${encodeURIComponent(slug)}`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (!sCheck.ok) {
      const t = await sCheck.text();
      console.error('check-slug fetch error:', t);
      return res.status(502).json({ available: false, reason: 'Could not check slug' });
    }
    const rows = await sCheck.json();
    if (!Array.isArray(rows) || rows.length === 0) return res.json({ available: true });
    // If the found project is the same as the one being edited, consider available
    if (ignoreProjectId && rows[0].id === ignoreProjectId) return res.json({ available: true });
    return res.json({ available: false, reason: 'Slug already in use' });
  } catch (err) {
    console.error('check-slug error', err);
    return res.status(500).json({ available: false, reason: err.message });
  }
};
