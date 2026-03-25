// Serverless endpoint to update a project record in Supabase
// Expects POST { project_id, title, slug, primary_color, accent_color }
// Uses SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL environment variables.

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const body = req.body || {};
    const { project_id, title, slug, primary_color, accent_color } = body;
    if (!project_id) return res.status(400).json({ error: 'Missing project_id' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: 'Supabase env vars not configured' });
    }

    // Authorization: require a Supabase access token to verify the caller owns the project
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const accessToken = authHeader.split(' ')[1];

    // Verify token using Supabase server client (Admin)
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      console.error('auth.getUser error', userErr);
      return res.status(401).json({ error: 'Invalid session' });
    }
    const userEmail = userData.user.email;
    if (!userEmail) return res.status(401).json({ error: 'Unauthenticated' });

    // Verify founder owned by this user (match by email)
    const fResp = await fetch(`${supabaseUrl}/rest/v1/founders?email=eq.${encodeURIComponent(userEmail)}`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (!fResp.ok) return res.status(500).json({ error: 'Could not verify founder ownership' });
    const fRows = await fResp.json();
    if (!Array.isArray(fRows) || fRows.length === 0) return res.status(403).json({ error: 'No founder record for user' });
    const founder = fRows[0];

  // Build update object only with provided fields
    const updateObj = {};
    if (typeof title === 'string') updateObj.title = title;
    if (typeof slug === 'string') updateObj.slug = slug;
    if (typeof primary_color === 'string') updateObj.primary_color = primary_color;
    if (typeof accent_color === 'string') updateObj.accent_color = accent_color;
  if (typeof body.logo_url === 'string') updateObj.logo_url = body.logo_url;

    if (Object.keys(updateObj).length === 0) return res.status(400).json({ error: 'No fields to update' });
    // Verify project exists and is owned by this founder
    const pCheck = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${encodeURIComponent(project_id)}`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (!pCheck.ok) {
      const t = await pCheck.text();
      console.error('Could not fetch project:', t);
      return res.status(502).json({ error: 'Could not fetch project' });
    }
    const pRows = await pCheck.json();
    if (!Array.isArray(pRows) || pRows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const project = pRows[0];
    if (project.founder_id !== founder.id) return res.status(403).json({ error: 'Not authorized to update this project' });

    // If slug is being changed, ensure uniqueness (no other project uses this slug)
    if (typeof updateObj.slug === 'string') {
      const slug = updateObj.slug.trim();
      if (slug.length === 0) return res.status(400).json({ error: 'Slug cannot be empty' });
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
        console.error('Could not check slug uniqueness:', t);
        return res.status(502).json({ error: 'Could not validate slug' });
      }
      const sRows = await sCheck.json();
      if (Array.isArray(sRows) && sRows.length > 0) {
        // if the existing project with this slug is not the same project, conflict
        const existing = sRows[0];
        if (existing.id !== project_id) {
          return res.status(409).json({ error: 'Slug already in use' });
        }
      }
    }

    // Perform the update
    const r = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${encodeURIComponent(project_id)}`, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updateObj)
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error('Supabase update error:', txt);
      return res.status(502).json({ error: 'Failed to update project' });
    }

    const updated = await r.json();
    return res.json({ project: updated[0] });
  } catch (err) {
    console.error('update-project error', err);
    return res.status(500).json({ error: err.message });
  }
};
