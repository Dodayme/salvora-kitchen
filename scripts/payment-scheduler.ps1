[CmdletBinding(SupportsShouldProcess=$true, ConfirmImpact='High')]
param(
  [ValidateSet('Plan','Install','Update','Status','Disable','Enable','Rollback')][string]$Action = 'Status',
  [string]$NodePath,
  [string]$BackupPath
)
$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskName = 'SalvoraKitchen-PaymentReconciliation-Local'
$taskPath = '\'
if (!$NodePath) { $NodePath = (Get-Command node.exe -ErrorAction Stop).Source }
$taskNode = [System.IO.Path]::GetFullPath($NodePath)
if (!(Test-Path -LiteralPath $taskNode -PathType Leaf) -or [System.IO.Path]::GetFileName($taskNode) -ine 'node.exe') { throw 'A valid absolute node.exe path is required.' }
$taskShell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$taskRunner = Join-Path $taskRoot 'scripts\run-payment-job.ps1'
$taskLegacyArguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $taskRunner + '" -NodePath "' + $taskNode + '"'
$taskBinary = Join-Path $taskRoot '.local\automation\SalvoraPaymentLauncher.exe'
$taskArguments = '"' + $taskNode + '"'
# Read failures (including access denied) must not be mistaken for an absent task.
$existingTask = @(Get-ScheduledTask -TaskPath $taskPath -ErrorAction Stop | Where-Object { $_.TaskName -eq $taskName })
if ($existingTask.Count -gt 1) { throw 'Ambiguous task identity.' }
$existingTask = $existingTask | Select-Object -First 1
function Get-OwnedActionKind($candidate) {
  if (!$candidate -or @($candidate.Actions).Count -ne 1) { return 'Unrecognized' }
  $item = $candidate.Actions[0]
  if ($item.WorkingDirectory -ine $taskRoot) { return 'Unrecognized' }
  if ($item.Execute -ieq $taskShell -and $item.Arguments -ceq $taskLegacyArguments) { return 'LegacyPowerShell' }
  if ($item.Execute -ieq $taskBinary -and $item.Arguments -ceq $taskArguments) { return 'GuiLauncher' }
  return 'Unrecognized'
}
$taskKind = if ($existingTask) { Get-OwnedActionKind $existingTask } else { 'Absent' }
if ($Action -eq 'Status' -or $Action -eq 'Plan') {
  if ($existingTask) {
    $taskInfo = $existingTask | Get-ScheduledTaskInfo
    [pscustomobject]@{TaskName=$taskName;State=[string]$existingTask.State;ActionKind=$taskKind;LogonType=[string]$existingTask.Principal.LogonType;Intervals=@($existingTask.Triggers | ForEach-Object {$_.Repetition.Interval});LastRunTime=$taskInfo.LastRunTime;LastTaskResult=$taskInfo.LastTaskResult;NextRunTime=$taskInfo.NextRunTime}
  } else { Write-Output 'Salvora local payment scheduler is not installed.' }
  if ($Action -eq 'Plan') { Write-Output 'Proposed action: local WindowsApplication launcher -> node.exe directly, no shell. Update changes only this existing action; triggers, account, enabled state, locks and payment policy stay unchanged. Backup first; no manual job start.' }
  exit 0
}
if ($existingTask -and $taskKind -eq 'Unrecognized') { throw 'Task name belongs to an unrecognized workspace/action. Refusing to change it.' }
if ($Action -eq 'Disable' -or $Action -eq 'Enable') {
  if (!$existingTask) { throw 'Task is absent.' }
  if ($PSCmdlet.ShouldProcess($taskName, "$Action future automatic payment checks; do not interrupt a running worker")) {
    if ($Action -eq 'Disable') { Disable-ScheduledTask -TaskName $taskName -TaskPath $taskPath | Out-Null } else { Enable-ScheduledTask -TaskName $taskName -TaskPath $taskPath | Out-Null }
    Write-Output "$Action completed; no manual job started."
  }
  exit 0
}
if ($Action -eq 'Rollback') {
  if (!$existingTask -or !$BackupPath) { throw 'Existing owned task and backup path required.' }
  $taskBackupDirectory = [System.IO.Path]::GetFullPath((Join-Path $taskRoot '.local\automation\task-backups')) + '\'
  $taskBackup = [System.IO.Path]::GetFullPath($BackupPath)
  if (!$taskBackup.StartsWith($taskBackupDirectory, [System.StringComparison]::OrdinalIgnoreCase) -or [System.IO.Path]::GetExtension($taskBackup) -ine '.xml') { throw 'Backup must be an XML file inside this workspace task-backups directory.' }
  $taskXmlSettings = New-Object System.Xml.XmlReaderSettings
  $taskXmlSettings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
  $taskXmlSettings.XmlResolver = $null
  # ReadAllText handles legacy UTF-8 backups whose exported declaration says
  # UTF-16; a TextReader prevents that declaration from mis-decoding file bytes.
  $taskTextReader = New-Object System.IO.StringReader([System.IO.File]::ReadAllText($taskBackup))
  $taskReader = [System.Xml.XmlReader]::Create($taskTextReader, $taskXmlSettings)
  $taskXml = New-Object System.Xml.XmlDocument
  $taskXml.XmlResolver = $null
  try { $taskXml.Load($taskReader) } finally { $taskReader.Dispose(); $taskTextReader.Dispose() }
  $taskNamespace = New-Object System.Xml.XmlNamespaceManager($taskXml.NameTable)
  $taskNamespace.AddNamespace('t','http://schemas.microsoft.com/windows/2004/02/mit/task')
  $taskExec = $taskXml.SelectNodes('/t:Task/t:Actions/*', $taskNamespace)
  if ($taskExec.Count -ne 1 -or $taskExec[0].LocalName -ne 'Exec') { throw 'Backup must contain exactly one owned Exec action.' }
  $taskOld = [pscustomobject]@{Actions=@([pscustomobject]@{Execute=[string]$taskExec[0].Command;Arguments=[string]$taskExec[0].Arguments;WorkingDirectory=[string]$taskExec[0].WorkingDirectory})}
  if ((Get-OwnedActionKind $taskOld) -eq 'Unrecognized') { throw 'Backup action is not owned by this workspace.' }
  if ($PSCmdlet.ShouldProcess($taskName, 'Restore only the backed-up action; keep current triggers/account/enabled state')) {
    $taskRestore = New-ScheduledTaskAction -Execute $taskOld.Actions[0].Execute -Argument $taskOld.Actions[0].Arguments -WorkingDirectory $taskRoot
    Set-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Action $taskRestore | Out-Null
    Write-Output 'Backed-up action restored; no manual job started.'
  }
  exit 0
}
if ($Action -eq 'Install' -and $existingTask) { Write-Output 'Task already exists; no duplicate created. Use Plan and explicit Update for migration.'; exit 0 }
if ($Action -eq 'Update' -and !$existingTask) { throw 'Update requires the existing task; no replacement task will be created.' }
$taskManifestPath = Join-Path $taskRoot '.local\automation\launcher-build.json'
if (!(Test-Path -LiteralPath $taskBinary) -or !(Test-Path -LiteralPath $taskManifestPath)) { throw 'Build the GUI launcher first with scripts/build-payment-launcher.ps1.' }
$taskManifest = Get-Content -LiteralPath $taskManifestPath -Raw | ConvertFrom-Json
function Get-ReadOnlyHash([string]$file) {
  $stream = [System.IO.File]::OpenRead($file)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try { return [System.BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','') } finally { $stream.Dispose(); $algorithm.Dispose() }
}
if ($taskManifest.sourceSha256 -ne (Get-ReadOnlyHash (Join-Path $PSScriptRoot 'PaymentJobLauncher.cs')) -or $taskManifest.binarySha256 -ne (Get-ReadOnlyHash $taskBinary) -or $taskManifest.subsystem -ne 'WindowsApplication') { throw 'Launcher build is stale or modified; rebuild and verify before updating the task.' }
if ($PSCmdlet.ShouldProcess($taskName, "$Action GUI launcher action for automatic payments")) {
  $taskAction = New-ScheduledTaskAction -Execute $taskBinary -Argument $taskArguments -WorkingDirectory $taskRoot
  if ($existingTask) {
    $taskBackupDirectory = Join-Path $taskRoot '.local\automation\task-backups'
    New-Item -ItemType Directory -Path $taskBackupDirectory -Force | Out-Null
    $taskBackup = Join-Path $taskBackupDirectory ('task-' + (Get-Date -Format 'yyyyMMddTHHmmss') + '-' + [guid]::NewGuid().ToString('N') + '.xml')
    # Export-ScheduledTask declares UTF-16: keep the persisted bytes consistent.
    [System.IO.File]::WriteAllText($taskBackup, (Export-ScheduledTask -TaskName $taskName -TaskPath $taskPath), [System.Text.Encoding]::Unicode)
    Set-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Action $taskAction | Out-Null
    Write-Output ('Action updated; backup: ' + $taskBackup + '. Triggers/account/enabled state preserved; no manual job started.')
  } else {
    $taskIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $taskTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
    $taskPrincipal = New-ScheduledTaskPrincipal -UserId $taskIdentity -LogonType Interactive -RunLevel Limited
    $taskSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Settings $taskSettings -Description 'Salvora local payment reconciliation via GUI launcher; no console; reads private workspace env.' | Out-Null
    Write-Output 'Single local payment scheduler installed; no manual job started.'
  }
}
