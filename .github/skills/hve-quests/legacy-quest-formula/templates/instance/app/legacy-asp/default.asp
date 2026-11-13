<%@ Language=VBScript %>
<% ' ARCHIVE-1997: source-only; Classic ASP and COM do not run in this playground.
' Kevin's unfinished lookup, retained for the security quest.
Dim sql: sql = "SELECT * FROM passengers WHERE name = '" & Request("name") & "'"
%>
<html><body><font face="Arial">EagleDesk legacy passenger lookup</font>
<object id="SeatLock" classid="CLSID:00000000-0000-0000-0000-000000000000"></object>
<script language="VBScript">Sub Window_OnLoad(): document.all("status").innerText = "Ready": End Sub</script>
<div id="status"></div></body></html>
