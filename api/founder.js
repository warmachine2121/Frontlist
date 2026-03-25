// Serverless endpoint to fetch a founder and their projects using the Supabase service role key.
// Usage:
//  GET /api/founder?id=<founder_id>
//  GET /api/founder?email=<email>

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://dimbgpgciszsviucsvui.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Supabase env vars not configured' });
  }

  const id = req.query.id;
  const email = req.query.email;

  try {
    let founder = null;
    if (id) {
      const r = await fetch(`${supabaseUrl}/rest/v1/founders?id=eq.${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (r.ok) {
        const rows = await r.json();
        if (Array.isArray(rows) && rows.length > 0) founder = rows[0];
      }
    } else if (email) {
      const r = await fetch(`${supabaseUrl}/rest/v1/founders?email=eq.${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (r.ok) {
        const rows = await r.json();
        if (Array.isArray(rows) && rows.length > 0) founder = rows[0];
      }
    } else {
      return res.status(400).json({ error: 'Provide id or email query param' });
    }

    if (!founder) return res.status(404).json({ error: 'Founder not found' });

    // Fetch projects for founder
    const pr = await fetch(`${supabaseUrl}/rest/v1/projects?founder_id=eq.${encodeURIComponent(founder.id)}`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });
    let projects = [];
    if (pr.ok) projects = await pr.json();

    return res.json({ founder, projects });
  } catch (err) {
    console.error('founder endpoint error', err);
    return res.status(500).json({ error: err.message });
  }
};
