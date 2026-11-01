param([Parameter(Mandatory=$true)][string]$NodePath)
$ErrorActionPreference = 'Stop'
try {
  $taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
  $taskRunner = Join-Path $taskRoot 'scripts\reconcile-payments.mjs'
  $taskProcess = Start-Process -FilePath $NodePath -ArgumentList ('--import tsx "' + $taskRunner + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -Wait -PassThru
  exit $taskProcess.ExitCode
} catch { Write-Error 'Salvora payment job launcher failed; check local runtime and scheduler configuration.'; exit 1 }
