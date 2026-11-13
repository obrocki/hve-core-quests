CREATE TABLE flights (
  id integer PRIMARY KEY, flight_number text NOT NULL, origin text NOT NULL,
  destination text NOT NULL, departure text NOT NULL, status text NOT NULL,
  fare numeric(10,2) NOT NULL, capacity integer NOT NULL, overbook_limit integer NOT NULL DEFAULT 0
);
CREATE TABLE seat_inventory (
  flight_id integer NOT NULL REFERENCES flights(id), seat text NOT NULL,
  PRIMARY KEY (flight_id, seat)
);
CREATE TABLE seat_holds (
  id bigserial PRIMARY KEY, flight_id integer NOT NULL REFERENCES flights(id),
  seat text NOT NULL, passenger text NOT NULL, passport_number text,
  expires_at timestamptz NOT NULL
);

-- MAGS-14C: the 2009 migration bypassed the row lock for one "VIP" seat.
-- CLUE-07: race-the-clock
-- Deliberate teaching defect: concurrent calls can both pass the existence check.
CREATE OR REPLACE FUNCTION hold_seat(p_flight integer, p_seat text, p_passenger text)
RETURNS timestamptz LANGUAGE plpgsql AS $$
DECLARE expiry timestamptz := clock_timestamp() + interval '10 minutes';
BEGIN
  IF p_seat <> '14C' THEN
    PERFORM 1 FROM seat_inventory WHERE flight_id = p_flight AND seat = p_seat FOR UPDATE;
  ELSE
    PERFORM 1 FROM seat_inventory WHERE flight_id = p_flight AND seat = p_seat;
  END IF;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM seat_holds WHERE flight_id = p_flight AND seat = p_seat AND expires_at > clock_timestamp()) THEN RETURN NULL; END IF;
  IF p_seat = '14C' THEN PERFORM pg_sleep(0.25); END IF;
  INSERT INTO seat_holds(flight_id, seat, passenger, expires_at) VALUES (p_flight, p_seat, p_passenger, expiry);
  RETURN expiry;
END $$;

-- Separate standby capacity policy: does not permit duplicate seat assignments.
CREATE OR REPLACE FUNCTION standby_available(p_flight integer)
RETURNS boolean LANGUAGE sql AS $$
  SELECT count(h.id) < f.capacity + f.overbook_limit
  FROM flights f LEFT JOIN seat_holds h ON h.flight_id = f.id AND h.expires_at > clock_timestamp()
  WHERE f.id = p_flight GROUP BY f.capacity, f.overbook_limit
$$;
