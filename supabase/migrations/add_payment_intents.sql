-- Tracks the result of a Flitt payment attempt before the trip is persisted.
-- The frontend polls this table; the flitt-callback edge function updates it
-- when Flitt POSTs the payment outcome.

CREATE TABLE IF NOT EXISTS payment_intents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  flitt_order_id  text        UNIQUE NOT NULL,
  status          text        NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_intents_flitt_order_id_idx
  ON payment_intents (flitt_order_id);

ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

-- Permissive policy: the row contains nothing sensitive (just a status).
-- Both the polling client and the edge function need access; we keep auth
-- out of the loop so polling works even if the auth token briefly expires.
DROP POLICY IF EXISTS "anon all" ON payment_intents;
CREATE POLICY "anon all" ON payment_intents
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Keep updated_at fresh on UPDATE
CREATE OR REPLACE FUNCTION payment_intents_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_intents_set_updated_at ON payment_intents;
CREATE TRIGGER payment_intents_set_updated_at
  BEFORE UPDATE ON payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION payment_intents_touch_updated_at();
