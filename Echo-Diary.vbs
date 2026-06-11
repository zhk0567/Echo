' Silent launcher — start packaged GUI exe directly (no PowerShell console)
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = root

unpackedExe = root & "\release\win-unpacked\Echo Diary.exe"
If fso.FileExists(unpackedExe) Then
  sh.Run Chr(34) & unpackedExe & Chr(34), 1, False
  WScript.Quit
End If

releaseDir = root & "\release"
If fso.FolderExists(releaseDir) Then
  Set newest = Nothing
  For Each f In fso.GetFolder(releaseDir).Files
    If LCase(fso.GetExtensionName(f.Name)) = "exe" And InStr(LCase(f.Name), "portable") > 0 Then
      If newest Is Nothing Then
        Set newest = f
      ElseIf f.DateLastModified > newest.DateLastModified Then
        Set newest = f
      End If
    End If
  Next
  If Not newest Is Nothing Then
    sh.Run Chr(34) & newest.Path & Chr(34), 1, False
    WScript.Quit
  End If
End If

' First-time setup / no release yet: hidden wrapper (window style 0)
sh.Environment("Process")("ECHO_APP_ROOT") = root
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & root & "\start.ps1""", 0, False
