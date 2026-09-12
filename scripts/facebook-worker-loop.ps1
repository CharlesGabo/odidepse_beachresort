$ErrorActionPreference = 'Continue'

$phpExecutable = 'C:\xampp\php\php.exe'
$worker = Join-Path $PSScriptRoot 'facebook-worker.php'

while ($true) {
    & $phpExecutable $worker *> $null
    Start-Sleep -Seconds 5
}
