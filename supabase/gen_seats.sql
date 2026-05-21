INSERT INTO seats (id, flight_id, row_number, seat_letter, class, extra_price, is_occupied)
SELECT
  gen_random_uuid(),
  f.id,
  r.row_number,
  s.letter,
  CASE WHEN r.row_number <= 2 THEN 'first'
       WHEN r.row_number <= 6 THEN 'business'
       ELSE 'economy' END,
  CASE WHEN r.row_number <= 2 THEN 150
       WHEN r.row_number <= 6 THEN 80
       ELSE 0 END,
  random() < 0.25
FROM flights f
CROSS JOIN (SELECT generate_series(1,30) AS row_number) r
CROSS JOIN (SELECT unnest(ARRAY['A','B','C','D','E','F']) AS letter) s;
