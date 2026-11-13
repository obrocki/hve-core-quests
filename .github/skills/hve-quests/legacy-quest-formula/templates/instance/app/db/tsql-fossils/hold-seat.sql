-- Globex migration note, 2009: do not run on PostgreSQL.
-- Kevin's 1998 seat-hold sketch, copied from SQL Server 7.0.
CREATE PROCEDURE HoldSeat @Flight int, @Seat varchar(3) AS
SELECT * FROM SeatHolds WITH (UPDLOCK) WHERE FlightId = @Flight AND Seat = @Seat
GO
