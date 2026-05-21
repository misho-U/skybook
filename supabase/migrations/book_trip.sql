CREATE OR REPLACE FUNCTION book_trip(
  p_trip_type       text,
  p_passenger_name  text,
  p_passenger_email text,
  p_passenger_phone text,
  p_passenger_count int,
  p_bookings        jsonb  -- array of {flight_id, seat_id, direction}
) RETURNS uuid AS $$
DECLARE
  v_trip_id uuid;
  v_seat_id uuid;
  b         jsonb;
BEGIN
  -- Check all seats are still available before touching anything
  FOR b IN SELECT * FROM jsonb_array_elements(p_bookings) LOOP
    v_seat_id := (b->>'seat_id')::uuid;
    IF (SELECT is_occupied FROM seats WHERE id = v_seat_id) THEN
      RAISE EXCEPTION 'SEAT_TAKEN:%', v_seat_id;
    END IF;
  END LOOP;

  -- Insert trip
  INSERT INTO trips (trip_type, passenger_name, passenger_email, passenger_phone, passenger_count)
  VALUES (p_trip_type::trip_type, p_passenger_name, p_passenger_email, p_passenger_phone, p_passenger_count)
  RETURNING id INTO v_trip_id;

  -- Insert bookings and mark seats occupied atomically in the same transaction
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
