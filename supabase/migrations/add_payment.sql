-- Add payment columns to trips
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS flitt_order_id text,
  ADD COLUMN IF NOT EXISTS payment_amount numeric(10,2);

-- Allow a trip owner to update their own trip (for payment status updates)
-- (service-role calls from edge functions bypass RLS automatically)
DROP POLICY IF EXISTS "trips_update" ON trips;
CREATE POLICY "trips_update" ON trips
  FOR UPDATE
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
