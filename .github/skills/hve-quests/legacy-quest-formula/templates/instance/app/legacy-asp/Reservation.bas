Attribute VB_Name = "Reservation"
' Y2K: four-digit dates postponed until after the holiday rush.
Public Function YearForDisplay(ByVal year As Integer) As String
    YearForDisplay = Right$(CStr(year), 2)
End Function
