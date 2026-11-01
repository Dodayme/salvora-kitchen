$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskSource = Join-Path $PSScriptRoot 'PaymentJobLauncher.cs'
$taskDirectory = Join-Path $taskRoot '.local\automation'
$taskBinary = Join-Path $taskDirectory 'SalvoraPaymentLauncher.exe'
$taskManifest = Join-Path $taskDirectory 'launcher-build.json'
$taskHash = (Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash
if ((Test-Path -LiteralPath $taskManifest) -and (Test-Path -LiteralPath $taskBinary)) {
  $taskBuilt = Get-Content -LiteralPath $taskManifest -Raw | ConvertFrom-Json
  if ($taskBuilt.sourceSha256 -eq $taskHash -and $taskBuilt.binarySha256 -eq (Get-FileHash -LiteralPath $taskBinary -Algorithm SHA256).Hash) { Write-Output 'Matching GUI launcher already built; no task changed.'; exit 0 }
}
New-Item -ItemType Directory -Path $taskDirectory -Force | Out-Null
$taskTemporary = Join-Path $taskDirectory ('launcher-' + [guid]::NewGuid().ToString('N') + '.exe')
Add-Type -TypeDefinition ([System.IO.File]::ReadAllText($taskSource)) -Language CSharp -OutputAssembly $taskTemporary -OutputType WindowsApplication -ErrorAction Stop
# Updating an executable in use fails rather than stopping the payment worker.
Move-Item -LiteralPath $taskTemporary -Destination $taskBinary -Force
$taskBuild = @{sourceSha256=$taskHash;binarySha256=(Get-FileHash -LiteralPath $taskBinary -Algorithm SHA256).Hash;subsystem='WindowsApplication'} | ConvertTo-Json
[System.IO.File]::WriteAllText($taskManifest, $taskBuild, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'GUI launcher compiled locally; no task installed, changed or executed.'
