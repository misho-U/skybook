-- =============================================================================
-- SkyBook – Database Schema  (v2 – round-trip support)
-- =============================================================================
-- Run this once against a fresh Supabase project (SQL Editor → Run).
-- Then run seed.sql to populate initial data.
-- =============================================================================


-- ── Enum types ────────────────────────────────────────────────────────────────

CREATE TYPE seat_class AS ENUM ('first', 'business', 'economy');
CREATE TYPE trip_type  AS ENUM ('one_way', 'round_trip');


-- ── airports ──────────────────────────────────────────────────────────────────

CREATE TABLE airports (
  id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code    VARCHAR(3)  NOT NULL UNIQUE,
  city    TEXT        NOT NULL,
  country TEXT        NOT NULL,
  flag    TEXT        NOT NULL
);

COMMENT ON TABLE  airports      IS 'IATA airports used as flight origins and destinations.';
COMMENT ON COLUMN airports.code IS 'Three-letter IATA airport code (unique).';
COMMENT ON COLUMN airports.flag IS 'Country flag as a Unicode emoji string.';


-- ── flights ───────────────────────────────────────────────────────────────────

CREATE TABLE flights (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_id        UUID          NOT NULL REFERENCES airports(id),
  destination_id   UUID          NOT NULL REFERENCES airports(id),
  airline          TEXT          NOT NULL,
  departure_time   TIMESTAMPTZ   NOT NULL,
  arrival_time     TIMESTAMPTZ   NOT NULL,
  base_price       NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  total_rows       INT           NOT NULL DEFAULT 30 CHECK (total_rows > 0),

  CONSTRAINT fk_origin            FOREIGN KEY (origin_id)      REFERENCES airports(id),
  CONSTRAINT fk_destination       FOREIGN KEY (destination_id) REFERENCES airports(id),
  CONSTRAINT different_airports   CHECK (origin_id <> destination_id),
  CONSTRAINT arrival_after_depart CHECK (arrival_time > departure_time)
);

COMMENT ON TABLE  flights            IS 'Scheduled flight legs with pricing and timing.';
COMMENT ON COLUMN flights.base_price IS 'Per-passenger base fare in USD, before seat class surcharge.';
COMMENT ON COLUMN flights.total_rows IS 'Number of seat rows on this aircraft (default 30).';


-- ── seats ─────────────────────────────────────────────────────────────────────

CREATE TABLE seats (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id   UUID          NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
  row_number  INT           NOT NULL CHECK (row_number >= 1),
  seat_letter CHAR(1)       NOT NULL CHECK (seat_letter IN ('A','B','C','D','E','F')),
  class       seat_class    NOT NULL,
  extra_price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (extra_price >= 0),
  is_occupied BOOLEAN       NOT NULL DEFAULT false,

  UNIQUE (flight_id, row_number, seat_letter)
);

COMMENT ON TABLE  seats             IS 'Individual seats for each flight.';
COMMENT ON COLUMN seats.extra_price IS 'Added to the flight base_price for this seat class.';
COMMENT ON COLUMN seats.is_occupied IS 'True if seat is pre-sold or unavailable.';


-- ── trips ─────────────────────────────────────────────────────────────────────
-- One row per booking transaction. Groups one leg (one-way) or two legs
-- (round-trip) together with shared passenger details.

CREATE TABLE trips (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_type        trip_type   NOT NULL DEFAULT 'one_way',
  passenger_count  INT         NOT NULL DEFAULT 1 CHECK (passenger_count >= 1),
  passenger_name   TEXT        NOT NULL,
  passenger_email  TEXT        NOT NULL,
  passenger_phone  TEXT        NOT NULL,
  booked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE trips IS 'One booking transaction, containing one or two flight legs.';


-- ── bookings ──────────────────────────────────────────────────────────────────
-- One row per seat per leg within a trip.
-- direction: 'outbound' for the first leg, 'return' for the second.

CREATE TABLE bookings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  flight_id   UUID        NOT NULL REFERENCES flights(id),
  seat_id     UUID        NOT NULL REFERENCES seats(id),
  direction   TEXT        NOT NULL CHECK (direction IN ('outbound', 'return')),

  UNIQUE (trip_id, seat_id)   -- a seat can't appear twice in the same trip
);

COMMENT ON TABLE  bookings           IS 'Individual seat reservations within a trip.';
COMMENT ON COLUMN bookings.direction IS '"outbound" or "return".';


-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_flights_origin      ON flights  (origin_id);
CREATE INDEX idx_flights_destination ON flights  (destination_id);
CREATE INDEX idx_flights_departure   ON flights  (departure_time);

CREATE INDEX idx_seats_flight_id     ON seats    (flight_id);
CREATE INDEX idx_seats_availability  ON seats    (flight_id, is_occupied);

CREATE INDEX idx_trips_email         ON trips    (passenger_email);
CREATE INDEX idx_bookings_trip_id    ON bookings (trip_id);
CREATE INDEX idx_bookings_flight_id  ON bookings (flight_id);
CREATE INDEX idx_bookings_seat_id    ON bookings (seat_id);


-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE airports ENABLE ROW LEVEL SECURITY;
ALTER TABLE flights  ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Reference data: public read
CREATE POLICY "airports: anon read"   ON airports FOR SELECT USING (true);
CREATE POLICY "flights: anon read"    ON flights  FOR SELECT USING (true);
CREATE POLICY "seats: anon read"      ON seats    FOR SELECT USING (true);
-- Booking flow marks seats occupied / free
CREATE POLICY "seats: anon update"    ON seats    FOR UPDATE USING (true) WITH CHECK (true);

-- Trips: full CRUD for demo (no auth)
CREATE POLICY "trips: anon read"      ON trips    FOR SELECT USING (true);
CREATE POLICY "trips: anon insert"    ON trips    FOR INSERT WITH CHECK (true);
CREATE POLICY "trips: anon delete"    ON trips    FOR DELETE USING (true);

-- Bookings: full CRUD for demo
CREATE POLICY "bookings: anon read"   ON bookings FOR SELECT USING (true);
CREATE POLICY "bookings: anon insert" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "bookings: anon delete" ON bookings FOR DELETE USING (true);
