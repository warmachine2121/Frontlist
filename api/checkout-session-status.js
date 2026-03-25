// Serverless endpoint to check status of a Checkout session and return associated founder record
// Query: /api/checkout-session-status?session_id={CHECKOUT_SESSION_ID}
// Requires: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }

  const sessionId = req.query && req.query.session_id;
  if (!sessionId) return res.status(400).json({ error: 'Missing session_id query param' });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const supabaseUrl = process.env.SUPABASE_URL || 'https://dimbgpgciszsviucsvui.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: 'Supabase env vars not configured' });
    }

    const founderId = session.metadata?.founder_id;
    let founder = null;

    if (founderId) {
      const resp = await fetch(`${supabaseUrl}/rest/v1/founders?id=eq.${encodeURIComponent(founderId)}`, {
        method: 'GET',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (resp.ok) {
        const rows = await resp.json();
        if (Array.isArray(rows) && rows.length > 0) founder = rows[0];
      }
    }

    // Fallback: try to find by email if founder not found and email available
    if (!founder) {
      const email = session.customer_details?.email || session.customer_email;
      if (email) {
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
      }
    }

    // Return a compact response: session status and founder summary (if any)
    return res.json({
      session: {
        id: session.id,
        payment_status: session.payment_status,
        status: session.status,
        customer: session.customer,
        customer_email: session.customer_details?.email || session.customer_email,
        metadata: session.metadata
      },
      founder: founder ? { id: founder.id, email: founder.email, plan: founder.plan, stripe_customer_id: founder.stripe_customer_id } : null
    });
  } catch (err) {
    console.error('checkout-session-status error:', err);
    return res.status(500).json({ error: err.message });
  }
};
