// Serverless function for Vercel: create a Stripe Checkout Session for the Pro subscription
// Expects these env vars to be set in deployment or locally:
// STRIPE_SECRET_KEY, STRIPE_PRICE_PRO_ID, BASE_URL

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// This endpoint expects JSON { email }
// It will create or reuse a founder row (plan = 'pending') via Supabase REST using the service role key,
// then create a Stripe Checkout session with metadata.founder_id so the webhook can map the session deterministically.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const body = req.body || {};
    const email = body.email && String(body.email).trim();
    if (!email) return res.status(400).json({ error: { message: 'Missing email in request body' } });

    const priceId = process.env.STRIPE_PRICE_PRO_ID;
    if (!priceId) {
      return res.status(500).json({ error: { message: 'Missing STRIPE_PRICE_PRO_ID env var' } });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ error: { message: 'Missing Supabase env vars' } });
    }

    // 1) Try to find existing founder by email
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
      // Create provisional founder with plan='pending'
      const createResp = await fetch(`${supabaseUrl}/rest/v1/founders`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ email: email, plan: 'pending' })
      });
      if (!createResp.ok) {
        const txt = await createResp.text();
        console.error('Supabase create founder error:', txt);
        return res.status(502).json({ error: { message: 'Error creating founder' } });
      }
      const created = await createResp.json();
      founderId = created[0].id;
      // Create a default project for the founder
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

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    // 2) Create the Stripe Checkout session and attach the founder_id in metadata
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        { price: priceId, quantity: 1 }
      ],
      customer_email: email,
      metadata: { founder_id: founderId },
      // Redirect to a lightweight status page that will poll the backend for subscription activation
      success_url: `${baseUrl}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({ error: { message: err.message } });
  }
};
