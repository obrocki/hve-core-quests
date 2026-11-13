<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="Default.aspx.cs" Inherits="EagleDesk.Default" %>
<!DOCTYPE html><html><head><title>EagleDesk WebForms archive</title></head><body>
<h1>Reservation archive</h1><p>WebForms migration layer, 2003. Seat holds use the PostgreSQL function.</p>
<form runat="server">
  <asp:Button runat="server" Text="Count flights" OnClick="CountFlights" />
  <p>Flight ID: <asp:TextBox ID="FlightId" runat="server" Text="101" />
  Seat: <asp:TextBox ID="Seat" runat="server" Text="14C" />
  Passenger: <asp:TextBox ID="Passenger" runat="server" Text="Guest Passenger" />
  <asp:Button runat="server" Text="Hold seat" OnClick="HoldSeat" /></p>
  <asp:Label ID="Result" runat="server" />
</form>
</body></html>
