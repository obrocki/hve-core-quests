using Npgsql;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("EagleDesk")
    ?? "Host=localhost;Database=eagledesk;Username=eagledesk;Password=local-demo-only";
builder.Services.AddSingleton(NpgsqlDataSource.Create(connectionString));
var app = builder.Build();

app.MapGet("/api/flights", async (NpgsqlDataSource db) =>
{
    await using var cmd = db.CreateCommand("SELECT id, flight_number, origin, destination, departure, status, fare FROM flights ORDER BY id");
    await using var reader = await cmd.ExecuteReaderAsync();
    var flights = new List<object>();
    while (await reader.ReadAsync())
        flights.Add(new { id = reader.GetInt32(0), number = reader.GetString(1), origin = reader.GetString(2), destination = reader.GetString(3), departure = reader.GetString(4), status = reader.GetString(5), fare = reader.GetDecimal(6) });
    return Results.Ok(flights);
});

app.MapPost("/api/holds", async (HoldRequest request, NpgsqlDataSource db) =>
{
    if (request.FlightId <= 0 || string.IsNullOrWhiteSpace(request.Seat) || string.IsNullOrWhiteSpace(request.Passenger))
        return Results.BadRequest(new { error = "Flight, seat and passenger are required." });
    await using var cmd = db.CreateCommand("SELECT hold_seat(@flight, @seat, @passenger)");
    cmd.Parameters.AddWithValue("flight", request.FlightId);
    cmd.Parameters.AddWithValue("seat", request.Seat);
    cmd.Parameters.AddWithValue("passenger", request.Passenger);
    var result = await cmd.ExecuteScalarAsync();
    if (result is not DateTime expiry) return Results.Conflict(new { error = "Seat unavailable or flight not found." });
    return Results.Ok(new { expiresAt = expiry });
});

// CEO-2024: "AI" is a rules-and-random stub, not a trained model.
app.MapGet("/api/fare-prediction", (decimal baseFare) =>
    Results.Ok(new { fare = Math.Round(baseFare * (1m + Random.Shared.Next(-5, 11) / 100m), 2), model = "rule-and-random-demo" }));
app.Run();

record HoldRequest(int FlightId, string Seat, string Passenger);
