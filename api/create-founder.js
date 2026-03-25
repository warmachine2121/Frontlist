// Serverless endpoint to create or upsert a founder record and a default project.
// Expects POST { email }
// Uses SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL env vars.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const body = req.body || {};
    const email = body.email && String(body.email).trim();
    if (!email) return res.status(400).json({ error: { message: 'Missing email in request body' } });

    const supabaseUrl = process.env.SUPABASE_URL || 'https://dimbgpgciszsviucsvui.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: { message: 'Missing Supabase env vars' } });
    }

    // Try to find existing founder by email
    let founderId = null;
    const getResp = await fetch(`${supabaseUrl}/rest/v1/founders?email=eq.${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (!getResp.ok) {
      const txt = await getResp.text();
      console.error('Supabase fetch error (GET founders):', txt);
      return res.status(502).json({ error: { message: 'Error contacting Supabase' } });
    }
    const existing = await getResp.json();
    if (Array.isArray(existing) && existing.length > 0) {
      founderId = existing[0].id;
    } else {
      // Create provisional founder with plan='free'
      const createResp = await fetch(`${supabaseUrl}/rest/v1/founders`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ email: email, plan: 'free' })
      });
      if (!createResp.ok) {
        const txt = await createResp.text();
        console.error('Supabase create founder error:', txt);
        return res.status(502).json({ error: { message: 'Error creating founder' } });
      }
      const created = await createResp.json();
      founderId = created[0].id;

      // Create a default project for the founder (best-effort)
      try {
        const defaultSlug = `f-${founderId.split('-')[0]}`;
        await fetch(`${supabaseUrl}/rest/v1/projects`, {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            founder_id: founderId,
            slug: defaultSlug,
            title: 'My Waitlist',
            description: '',
            logo_url: '',
            primary_color: '#1B4332',
            accent_color: '#E8622A'
          })
        });
      } catch (projErr) {
        console.error('Could not create default project:', projErr);
      }
    }

    return res.json({ id: founderId });
  } catch (err) {
    console.error('create-founder error:', err);
    return res.status(500).json({ error: { message: err.message } });
  }
};
