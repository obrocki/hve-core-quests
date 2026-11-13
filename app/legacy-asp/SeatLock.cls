VERSION 1.0 CLASS
BEGIN
  MultiUse = -1
END
Attribute VB_Name = "SeatLock"
' Mags, 1997: compiled SeatLock.dll is missing; never execute this archive.
Public Function HoldSeat(ByVal flight As Long, ByVal seat As String) As Boolean
    ' TODO Kevin: add real locking before launch.
    HoldSeat = True
End Function
