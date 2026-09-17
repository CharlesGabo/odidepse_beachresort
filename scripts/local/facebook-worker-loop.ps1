$ErrorActionPreference = 'Continue'

$phpExecutable = 'C:\xampp\php\php.exe'
$worker = Join-Path (Split-Path -Parent $PSScriptRoot) 'operations\facebook-worker.php'

while ($true) {
    & $phpExecutable $worker *> $null
    Start-Sleep -Seconds 1
}
