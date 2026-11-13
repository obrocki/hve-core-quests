using System;
using System.Web.UI;
using System.Web.UI.WebControls;
using Npgsql;
namespace EagleDesk {
    public partial class Default : Page {
        protected Label Result;
        protected TextBox FlightId, Seat, Passenger;
        protected void CountFlights(object sender, EventArgs e) {
            using (var connection = new NpgsqlConnection(Environment.GetEnvironmentVariable("EAGLEDESK_DB"))) {
                connection.Open();
                using (var command = new NpgsqlCommand("SELECT count(*) FROM flights", connection))
                    Result.Text = " Flights: " + command.ExecuteScalar();
            }
            protected void HoldSeat(object sender, EventArgs e) {
                int flightId;
                if (!int.TryParse(FlightId.Text, out flightId) || flightId <= 0 ||
                    String.IsNullOrWhiteSpace(Seat.Text) || String.IsNullOrWhiteSpace(Passenger.Text)) {
                    Result.Text = "Flight, seat and passenger are required.";
                    return;
                }
                using (var connection = new NpgsqlConnection(Environment.GetEnvironmentVariable("EAGLEDESK_DB"))) {
                    connection.Open();
                    using (var command = new NpgsqlCommand("SELECT hold_seat(@flight, @seat, @passenger)", connection)) {
                        command.Parameters.AddWithValue("flight", flightId);
                        command.Parameters.AddWithValue("seat", Seat.Text.Trim());
                        command.Parameters.AddWithValue("passenger", Passenger.Text.Trim());
                        var expiry = command.ExecuteScalar();
                        Result.Text = expiry == DBNull.Value ? "Seat unavailable or flight not found." :
                            "Seat held until " + Server.HtmlEncode(expiry.ToString());
                    }
                }
            }
        }
    }
}
