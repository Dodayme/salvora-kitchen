# Uses isolated PowerShell runspaces and mocked ScheduledTasks functions only.
# No real task cmdlet or payment runner is executed.
$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskNode = (Get-Command node.exe).Source
$taskPath = Join-Path $taskRoot 'scripts\payment-scheduler.ps1'
function Invoke-SchedulerFixture([string]$Scenario, [string]$Action, [bool]$DryRun = $false) {
  $taskRunspace = [powershell]::Create()
  try {
    $taskFixture = @'
param($root,$node,$scriptPath,$scenario,$action,$dryRun)
$global:calls = New-Object System.Collections.Generic.List[string]
$global:lastSetParameters = $null
$global:fixture = [pscustomobject]@{TaskName='SalvoraKitchen-PaymentReconciliation-Local';State='Ready';Principal=[pscustomobject]@{LogonType='Interactive'};Triggers=@([pscustomobject]@{Repetition=[pscustomobject]@{Interval='PT1M'}});Actions=@([pscustomobject]@{Execute=(Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe');Arguments=('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $root 'scripts\run-payment-job.ps1') + '" -NodePath "' + $node + '"');WorkingDirectory=$root})}
if ($scenario -eq 'Foreign') { $global:fixture.Actions[0].WorkingDirectory='C:\unrelated' }
function Get-ScheduledTask { param($TaskPath,$ErrorAction); $global:calls.Add('Read'); if ($scenario -ne 'Absent') { $global:fixture } }
function Get-ScheduledTaskInfo { param([Parameter(ValueFromPipeline=$true)]$InputObject); process { [pscustomobject]@{LastRunTime=[datetime]'2026-01-01';LastTaskResult=1;NextRunTime=[datetime]'2026-01-01'} } }
function New-ScheduledTaskAction { param($Execute,$Argument,$WorkingDirectory); [pscustomobject]@{Execute=$Execute;Arguments=$Argument;WorkingDirectory=$WorkingDirectory} }
function Set-ScheduledTask { param($TaskName,$TaskPath,$Action); $global:calls.Add('Set'); $global:lastSetParameters=@($PSBoundParameters.Keys) }
function Register-ScheduledTask { throw 'Unexpected real/install mutation path in fixture' }
function Export-ScheduledTask { param($TaskName,$TaskPath); $global:calls.Add('Backup'); '<Task xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"><Actions /></Task>' }
function Disable-ScheduledTask { param($TaskName,$TaskPath); $global:calls.Add('Disable') }
function Enable-ScheduledTask { param($TaskName,$TaskPath); $global:calls.Add('Enable') }
function Stop-ScheduledTask { throw 'Must not stop an in-flight worker' }
function Unregister-ScheduledTask { throw 'Must not delete a task' }
function Start-ScheduledTask { throw 'Must not start payments during management' }
$invokeParameters = @{Action=$action;Confirm=$false}
if ($dryRun) { $invokeParameters.WhatIf=$true }
try { & $scriptPath @invokeParameters; } catch { $global:calls.Add('Rejected') }
'@
    $null = $taskRunspace.AddScript($taskFixture).AddArgument($taskRoot).AddArgument($taskNode).AddArgument($taskPath).AddArgument($Scenario).AddArgument($Action).AddArgument($DryRun).Invoke()
    if ($taskRunspace.HadErrors -and !($taskRunspace.Runspace.SessionStateProxy.GetVariable('calls') -contains 'Rejected')) { throw ('Scheduler fixture runspace failed: ' + (($taskRunspace.Streams.Error | ForEach-Object {$_.ToString()}) -join '; ')) }
    return [pscustomobject]@{Calls=@($taskRunspace.Runspace.SessionStateProxy.GetVariable('calls'));SetParameters=@($taskRunspace.Runspace.SessionStateProxy.GetVariable('lastSetParameters'))}
  } finally { $taskRunspace.Dispose() }
}
function Assert-Calls($result,[string]$expected) { if (($result.Calls -join ',') -ne $expected) { throw ('Unexpected fixture management calls; expected ' + $expected + ', got ' + ($result.Calls -join ',')) } }
$taskCases = @(
  @{Scenario='Owned';Action='Status';Expected='Read'},
  @{Scenario='Owned';Action='Plan';Expected='Read'},
  @{Scenario='Owned';Action='Install';Expected='Read'},
  @{Scenario='Owned';Action='Update';DryRun=$true;Expected='Read'},
  @{Scenario='Owned';Action='Disable';Expected='Read,Disable'},
  @{Scenario='Owned';Action='Enable';Expected='Read,Enable'},
  @{Scenario='Foreign';Action='Disable';Expected='Read,Rejected'},
  @{Scenario='Absent';Action='Update';Expected='Read,Rejected'}
)
foreach ($taskCase in $taskCases) {
  $taskResult = Invoke-SchedulerFixture $taskCase.Scenario $taskCase.Action ([bool]$taskCase.DryRun)
  Assert-Calls $taskResult $taskCase.Expected
}
Write-Output 'Scheduler safety fixtures passed: read-only Status/Plan, WhatIf without writes, no duplicate Install, reversible Enable/Disable, foreign task/absent Update rejected. No Windows task or payment calls.'
