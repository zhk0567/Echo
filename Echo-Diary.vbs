' Silent launcher (no command window) — used if shortcut must set ECHO_APP_ROOT
Set sh = CreateObject("WScript.Shell")
root = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = root
sh.Environment("Process")("ECHO_APP_ROOT") = root

unpacked = root & "\release\win-unpacked\Echo Diary.exe"
Set fso = CreateObject("Scripting.FileSystemObject")
If fso.FileExists(unpacked) Then
  sh.Run """" & unpacked & """", 1, False
Else
  For Each f In fso.GetFolder(root & "\release").Files
    If InStr(f.Name, "Echo-Diary-") > 0 And InStr(f.Name, "-portable.exe") > 0 Then
      sh.Run """" & f.Path & """", 1, False
      WScript.Quit 0
    End If
  Next
  sh.Run "cmd /c npm run dev", 0, False
End If
