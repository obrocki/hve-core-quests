INSERT INTO flights VALUES
 (101,'{{AIRLINE_CODE}}101','SEA','JFK','08:30','On time',249,9,1),
 (202,'{{AIRLINE_CODE}}202','JFK','SEA','10:15','On time',279,9,1),
 (303,'{{AIRLINE_CODE}}303','ORD','LAX','12:45','Boarding',199,9,0),
 (404,'{{AIRLINE_CODE}}404','SEA','LAX','14:20','Delayed',189,9,0);
INSERT INTO seat_inventory(flight_id, seat)
 SELECT f.id, s.seat FROM flights f CROSS JOIN
 (VALUES ('12A'),('12B'),('12C'),('14A'),('14B'),('14C'),('15A'),('15B'),('15C')) AS s(seat);
