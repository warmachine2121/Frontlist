// Temporary debug endpoint — delete after fixing env vars
module.exports = (req, res) => {
  res.json({
    SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'SET' : 'MISSING',
    STRIPE_PRICE_PRO_ID: process.env.STRIPE_PRICE_PRO_ID ? 'SET' : 'MISSING',
    BASE_URL: process.env.BASE_URL ? 'SET' : 'MISSING',
  });
};
