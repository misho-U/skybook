-- Add user_id to trips
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trips_user_id_idx ON trips(user_id);

-- Enable RLS
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Users can read their own trips; allow null user_id for legacy rows
CREATE POLICY "trips_select" ON trips
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

-- Only the authenticated user can insert their own trips (enforced in function)
CREATE POLICY "trips_insert" ON trips
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Only the trip owner can delete
CREATE POLICY "trips_delete" ON trips
  FOR DELETE USING (user_id = auth.uid());

-- Drop old function before recreating with new signature
DROP FUNCTION IF EXISTS book_trip(text, int, int, int, jsonb, text, text, jsonb);

CREATE OR REPLACE FUNCTION book_trip(
  p_trip_type     text,
  p_adults        int,
  p_children      int,
  p_infants       int,
  p_passengers    jsonb,   -- array of {type, firstName, lastName, dob, passport?}
  p_contact_email text,
  p_contact_phone text,
  p_bookings      jsonb,   -- array of {flight_id, seat_id, direction}
  p_user_id       uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_trip_id  uuid;
  v_seat_id  uuid;
  b          jsonb;
  v_lead     jsonb;
BEGIN
  -- Check all seats are still available before touching anything
  FOR b IN SELECT * FROM jsonb_array_elements(p_bookings) LOOP
    v_seat_id := (b->>'seat_id')::uuid;
    IF (SELECT is_occupied FROM seats WHERE id = v_seat_id) THEN
      RAISE EXCEPTION 'SEAT_TAKEN:%', v_seat_id;
    END IF;
  END LOOP;

  v_lead := p_passengers->0;

  INSERT INTO trips (
    trip_type,
    passenger_count, passenger_name, passenger_email, passenger_phone,
    adults, children, infants,
    passengers, contact_email, contact_phone,
    user_id
  )
  VALUES (
    p_trip_type::trip_type,
    p_adults + p_children + p_infants,
    (v_lead->>'firstName') || ' ' || (v_lead->>'lastName'),
    p_contact_email,
    p_contact_phone,
    p_adults, p_children, p_infants,
    p_passengers,
    p_contact_email,
    p_contact_phone,
    p_user_id
  )
  RETURNING id INTO v_trip_id;

  FOR b IN SELECT * FROM jsonb_array_elements(p_bookings) LOOP
    INSERT INTO bookings (trip_id, flight_id, seat_id, direction)
    VALUES (
      v_trip_id,
      (b->>'flight_id')::uuid,
      (b->>'seat_id')::uuid,
      b->>'direction'
    );

    UPDATE seats SET is_occupied = true WHERE id = (b->>'seat_id')::uuid;
  END LOOP;

  RETURN v_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION book_trip(text, int, int, int, jsonb, text, text, jsonb, uuid) TO authenticated;
