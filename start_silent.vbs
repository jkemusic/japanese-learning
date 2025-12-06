Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
' Get the directory where this script is located
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
' Build path to start_app.bat
strPath = fso.BuildPath(strDir, "start_app.bat")

' Run the batch file hidden (0)
WshShell.Run chr(34) & strPath & chr(34), 0
Set WshShell = Nothing
