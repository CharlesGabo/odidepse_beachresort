$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$phpExecutable = 'C:\xampp\php\php.exe'
$cloudflaredExecutable = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$router = Join-Path $PSScriptRoot 'preview-router.php'
$previewAddress = '127.0.0.1'
$previewPort = 8765
$previewUrl = "http://${previewAddress}:${previewPort}"

if (-not (Test-Path -LiteralPath $phpExecutable -PathType Leaf)) {
    throw "XAMPP PHP was not found at $phpExecutable."
}

if (-not (Test-Path -LiteralPath $cloudflaredExecutable -PathType Leaf)) {
    throw "cloudflared was not found at $cloudflaredExecutable."
}

$portInUse = Get-NetTCPConnection -LocalAddress $previewAddress -LocalPort $previewPort -State Listen -ErrorAction SilentlyContinue
if ($portInUse) {
    throw "Port $previewPort is already in use. Close the existing preview server and try again."
}

$phpProcess = $null

try {
    $phpProcess = Start-Process `
        -FilePath $phpExecutable `
        -ArgumentList @('-S', "${previewAddress}:${previewPort}", '-t', $projectRoot, $router) `
        -WindowStyle Hidden `
        -PassThru

    Start-Sleep -Seconds 1
    $health = Invoke-RestMethod -Uri "$previewUrl/api/hello.php" -TimeoutSec 10
    if ($health.status -ne 'success') {
        throw 'The local PHP health check did not return a successful response.'
    }

    Write-Host ''
    Write-Host 'Odidepse local preview is ready.' -ForegroundColor Green
    Write-Host 'Cloudflare will print the public trycloudflare.com URL below.'
    Write-Host 'Keep this window open while your client is reviewing the site.'
    Write-Host 'Press Ctrl+C to stop sharing.'
    Write-Host ''

    & $cloudflaredExecutable tunnel --url $previewUrl
}
finally {
    if ($phpProcess -and -not $phpProcess.HasExited) {
        Stop-Process -Id $phpProcess.Id -Force
    }
}
