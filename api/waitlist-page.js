// Serves the public waitlist page for a given slug.
// Routed via vercel.json rewrite: /:slug -> /api/waitlist-page?slug=:slug

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function notFoundHtml(slug) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Not found</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9f9f9}
.box{text-align:center;padding:2rem}</style></head>
<body><div class="box"><h2>Page not found</h2><p>No waitlist exists at <strong>/${escHtml(slug)}</strong>.</p></div></body></html>`;
}

function renderPage(project, count) {
  const primary = escHtml(project.primary_color || '#111111');
  const accent  = escHtml(project.accent_color  || '#ffffff');
  const title   = escHtml(project.title         || 'Join the waitlist');
  const desc    = escHtml(project.description   || '');
  const logoUrl = escHtml(project.logo_url      || '');
  const projectId = escHtml(project.id);

  const countLine = count > 0
    ? `<p class="count">${count.toLocaleString()} ${count === 1 ? 'person' : 'people'} on the list</p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 24px rgba(0,0,0,.08);
      max-width: 480px;
      width: 100%;
      padding: 2.5rem 2rem;
      text-align: center;
    }
    .logo { max-height: 64px; max-width: 200px; margin-bottom: 1.5rem; }
    h1 { font-size: 1.75rem; font-weight: 700; color: ${primary}; line-height: 1.2; margin-bottom: .75rem; }
    .desc { color: #555; line-height: 1.6; margin-bottom: 1.25rem; font-size: .975rem; }
    .count { font-size: .875rem; color: #888; margin-bottom: 1.5rem; }
    .form-row { display: flex; gap: .5rem; margin-top: .5rem; }
    input[type=email] {
      flex: 1;
      padding: .65rem .9rem;
      border: 1.5px solid #ddd;
      border-radius: 7px;
      font-size: 1rem;
      outline: none;
      transition: border-color .15s;
    }
    input[type=email]:focus { border-color: ${primary}; }
    .btn {
      padding: .65rem 1.25rem;
      background: ${primary};
      color: ${accent};
      border: none;
      border-radius: 7px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity .15s;
    }
    .btn:disabled { opacity: .6; cursor: default; }
    .msg { margin-top: 1rem; font-size: .9rem; min-height: 1.2em; }
    .msg.success { color: #2a7a4b; }
    .msg.error   { color: #c0392b; }
    .powered { margin-top: 2rem; font-size: .75rem; color: #bbb; }
    .powered a { color: #bbb; }
  </style>
</head>
<body>
  <div class="card">
    ${logoUrl ? `<img class="logo" src="${logoUrl}" alt="logo">` : ''}
    <h1>${title}</h1>
    ${desc ? `<p class="desc">${desc}</p>` : ''}
    ${countLine}
    <form id="wl-form">
      <div class="form-row">
        <input type="email" id="wl-email" placeholder="you@example.com" required autocomplete="email">
        <button class="btn" type="submit" id="wl-btn">Join</button>
      </div>
    </form>
    <div class="msg" id="wl-msg"></div>
    <p class="powered">Powered by <a href="/" target="_blank">Frontlist</a></p>
  </div>

  <script>
    const form  = document.getElementById('wl-form');
    const btn   = document.getElementById('wl-btn');
    const msg   = document.getElementById('wl-msg');
    const input = document.getElementById('wl-email');

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      const email = input.value.trim();
      if (!email) return;
      btn.disabled = true;
      btn.textContent = 'Joining…';
      msg.className = 'msg';
      msg.textContent = '';
      try {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: '${projectId}', email })
        });
        const data = await res.json();
        if (res.ok) {
          form.style.display = 'none';
          msg.className = 'msg success';
          msg.textContent = "You're on the list! We'll be in touch.";
        } else if (data.error === 'already_signed_up') {
          msg.className = 'msg success';
          msg.textContent = "You're already on the list.";
          btn.disabled = false;
          btn.textContent = 'Join';
        } else {
          throw new Error(data.error || 'Something went wrong');
        }
      } catch (err) {
        msg.className = 'msg error';
        msg.textContent = err.message || 'Something went wrong. Please try again.';
        btn.disabled = false;
        btn.textContent = 'Join';
      }
    });
  </script>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const slug = (req.query.slug || '').trim().toLowerCase();
  if (!slug) return res.status(400).send('Missing slug');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).send('Server misconfigured');

  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  };

  // Fetch project by slug
  const pRes = await fetch(
    `${supabaseUrl}/rest/v1/projects?slug=eq.${encodeURIComponent(slug)}&select=*`,
    { headers }
  );
  if (!pRes.ok) return res.status(502).send('Could not load page');

  const rows = await pRes.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(notFoundHtml(slug));
  }
  const project = rows[0];

  // Get signup count
  let count = 0;
  try {
    const cRes = await fetch(
      `${supabaseUrl}/rest/v1/signups?project_id=eq.${encodeURIComponent(project.id)}&select=id`,
      { headers: { ...headers, 'Prefer': 'count=exact' } }
    );
    if (cRes.ok) {
      const cr = cRes.headers.get('content-range') || '';
      const m  = cr.match(/\/(\d+)/);
      if (m) count = parseInt(m[1], 10);
    }
  } catch (_) { /* non-fatal */ }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  return res.status(200).send(renderPage(project, count));
};
