-- Example SQL showing an upsert for founders used by the webhook
-- This can be executed directly against Postgres/Supabase using the service role key

-- Insert or update based on email
INSERT INTO founders (email, stripe_customer_id, plan)
VALUES ('founder@example.com', 'cus_ABC123', 'pro')
ON CONFLICT (email)
DO UPDATE SET
  stripe_customer_id = EXCLUDED.stripe_customer_id,
  plan = EXCLUDED.plan;

-- Example to downgrade a founder by stripe_customer_id
UPDATE founders
SET plan = 'free'
WHERE stripe_customer_id = 'cus_ABC123';
