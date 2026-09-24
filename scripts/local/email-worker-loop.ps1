$ErrorActionPreference = 'Continue'
$phpExecutable = 'C:\xampp\php\php.exe'
$worker = Join-Path (Split-Path -Parent $PSScriptRoot) 'operations\email-worker.php'
while ($true) {
    & $phpExecutable $worker
    Start-Sleep -Seconds 1
}
