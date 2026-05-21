-- Add multi-passenger columns to trips table
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS adults        int  DEFAULT 1,
  ADD COLUMN IF NOT EXISTS children      int  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS infants       int  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passengers    jsonb,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

-- Replace the old book_trip function with multi-passenger version
CREATE OR REPLACE FUNCTION book_trip(
  p_trip_type     text,
  p_adults        int,
  p_children      int,
  p_infants       int,
  p_passengers    jsonb,   -- array of {type, firstName, lastName, dob, passport?}
  p_contact_email text,
  p_contact_phone text,
  p_bookings      jsonb    -- array of {flight_id, seat_id, direction}
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

  -- Derive lead name for the legacy passenger_name column
  v_lead := p_passengers->0;

  INSERT INTO trips (
    trip_type,
    passenger_count, passenger_name, passenger_email, passenger_phone,
    adults, children, infants,
    passengers, contact_email, contact_phone
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
    p_contact_phone
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
$$ LANGUAGE plpgsql;
