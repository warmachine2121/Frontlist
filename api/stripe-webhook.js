// Vercel serverless function to handle Stripe webhooks.
// Verifies the Stripe signature and upserts a founder record in Supabase using the service role key.
// Required env vars:
//  - STRIPE_SECRET_KEY
//  - STRIPE_WEBHOOK_SECRET
//  - SUPABASE_URL
//  - SUPABASE_SERVICE_ROLE_KEY

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Helper to read the raw request body as a Buffer
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    // Allow disabling signature verification for local testing by setting DISABLE_STRIPE_WEBHOOK_VERIFY=1
    if (process.env.DISABLE_STRIPE_WEBHOOK_VERIFY === '1') {
      const buf = await getRawBody(req);
      event = JSON.parse(buf.toString());
      console.warn('Stripe webhook signature verification disabled (dev only)');
    } else {
      if (!webhookSecret) {
        console.error('Missing STRIPE_WEBHOOK_SECRET env var');
        return res.status(500).send('Webhook not configured');
      }
      const buf = await getRawBody(req);
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event types we care about
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Prefer founder_id from metadata if present (deterministic mapping)
        const founderIdFromMetadata = session.metadata?.founder_id;
        const email = session.customer_details?.email || session.customer_email;
        const stripeCustomerId = session.customer;

        const supabaseUrl = process.env.SUPABASE_URL || 'https://dimbgpgciszsviucsvui.supabase.co';
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          console.error('Missing Supabase env vars');
          break;
        }

        if (founderIdFromMetadata) {
          // Update the provisional founder created before redirect
          await fetch(`${supabaseUrl}/rest/v1/founders?id=eq.${founderIdFromMetadata}`, {
            method: 'PATCH',
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({ stripe_customer_id: stripeCustomerId, plan: 'pro' })
          });
          console.log(`Updated founder id=${founderIdFromMetadata} to pro`);
        } else if (email) {
          // Fallback to email-based upsert
          const fetchExisting = await fetch(`${supabaseUrl}/rest/v1/founders?email=eq.${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json'
            }
          });
          const existing = await fetchExisting.json();
          if (Array.isArray(existing) && existing.length > 0) {
            const id = existing[0].id;
            await fetch(`${supabaseUrl}/rest/v1/founders?id=eq.${id}`, {
              method: 'PATCH',
              headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify({ stripe_customer_id: stripeCustomerId, plan: 'pro' })
            });
            console.log(`Updated founder ${email} -> id ${id}`);
          } else {
            await fetch(`${supabaseUrl}/rest/v1/founders`, {
              method: 'POST',
              headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify({ email: email, stripe_customer_id: stripeCustomerId, plan: 'pro' })
            });
            console.log(`Created founder ${email}`);
          }
        } else {
          console.warn('checkout.session.completed without metadata or email; skipping founder upsert');
        }

        break;
      }

      case 'invoice.paid': {
        // Could be used to mark subscriptions active or record invoices
        const invoice = event.data.object;
        console.log('invoice.paid for', invoice.customer);
        break;
      }

      case 'customer.subscription.deleted': {
        // Subscription cancelled; downgrade plan
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;
        const supabaseUrl = process.env.SUPABASE_URL || 'https://dimbgpgciszsviucsvui.supabase.co';
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && serviceKey && stripeCustomerId) {
          // Find founder by stripe_customer_id and set plan to 'free'
          const find = await fetch(`${supabaseUrl}/rest/v1/founders?stripe_customer_id=eq.${encodeURIComponent(stripeCustomerId)}`, {
            method: 'GET',
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json'
            }
          });
          const rows = await find.json();
          if (Array.isArray(rows) && rows.length > 0) {
            const id = rows[0].id;
            await fetch(`${supabaseUrl}/rest/v1/founders?id=eq.${id}`, {
              method: 'PATCH',
              headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify({ plan: 'free' })
            });
            console.log(`Downgraded founder id=${id} to free`);
          }
        }
        break;
      }

      default:
        // Unexpected event type
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 to acknowledge receipt of the event
    res.status(200).send('OK');
  } catch (err) {
    console.error('Error handling webhook event:', err);
    res.status(500).send('Internal Server Error');
  }
};
