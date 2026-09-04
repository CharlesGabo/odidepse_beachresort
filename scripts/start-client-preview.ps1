$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$phpExecutable = 'C:\xampp\php\php.exe'
$npmExecutable = 'C:\Program Files\nodejs\npm.cmd'
$cloudflaredExecutable = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$router = Join-Path $PSScriptRoot 'preview-router.php'
$distRoot = Join-Path $projectRoot 'dist'
$previewAddress = '127.0.0.1'
$previewPort = 8765
$previewUrl = "http://${previewAddress}:${previewPort}"

if (-not (Test-Path -LiteralPath $phpExecutable -PathType Leaf)) {
    throw "XAMPP PHP was not found at $phpExecutable."
}

if (-not (Test-Path -LiteralPath $npmExecutable -PathType Leaf)) {
    throw "npm was not found at $npmExecutable. Install Node.js before starting the preview."
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
    Write-Host 'Building the React frontend...' -ForegroundColor Cyan
    Push-Location $projectRoot
    try {
        & $npmExecutable run build
        if ($LASTEXITCODE -ne 0) {
            throw 'The Vite production build failed.'
        }
    }
    finally {
        Pop-Location
    }

    if (-not (Test-Path -LiteralPath (Join-Path $distRoot 'index.html') -PathType Leaf)) {
        throw 'The Vite build did not create dist\index.html.'
    }

    $phpProcess = Start-Process `
        -FilePath $phpExecutable `
        -ArgumentList @('-S', "${previewAddress}:${previewPort}", '-t', $distRoot, $router) `
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
