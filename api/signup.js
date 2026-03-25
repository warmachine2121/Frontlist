// POST /api/signup — records an email signup for a project's waitlist
// Body: { project_id: string, email: string }

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};
    const project_id = (body.project_id || '').trim();
    const email      = (body.email      || '').trim().toLowerCase();

    if (!project_id || !email) {
      return res.status(400).json({ error: 'Missing project_id or email' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || 'https://dimbgpgciszsviucsvui.supabase.co';
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const r = await fetch(`${supabaseUrl}/rest/v1/signups`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ project_id, email })
    });

    if (r.ok || r.status === 201) {
      return res.status(200).json({ success: true });
    }

    const txt = await r.text();

    // Unique constraint violation — already signed up
    if (r.status === 409 || txt.includes('23505') || txt.includes('unique')) {
      return res.status(409).json({ error: 'already_signed_up' });
    }

    console.error('signup insert error:', r.status, txt);
    return res.status(502).json({ error: 'Could not save signup' });

  } catch (err) {
    console.error('signup error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
