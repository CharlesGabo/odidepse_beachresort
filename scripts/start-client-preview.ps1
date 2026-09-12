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
$cloudflaredProcess = $null
$cloudflaredStdout = $null
$cloudflaredStderr = $null
$workerProcess = $null

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

    & $phpExecutable (Join-Path $PSScriptRoot 'reset-facebook-webhook-state.php')
    if ($LASTEXITCODE -ne 0) {
        throw 'The Facebook webhook connection state could not be reset for the new temporary URL.'
    }

    $workerProcess = Start-Process `
        -FilePath 'powershell.exe' `
        -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'facebook-worker-loop.ps1')) `
        -WindowStyle Hidden `
        -PassThru

    $cloudflaredStdout = [System.IO.Path]::GetTempFileName()
    $cloudflaredStderr = [System.IO.Path]::GetTempFileName()

    Write-Host 'Starting the Cloudflare tunnel...' -ForegroundColor Cyan
    $cloudflaredProcess = Start-Process `
        -FilePath $cloudflaredExecutable `
        -ArgumentList @('tunnel', '--protocol', 'http2', '--url', $previewUrl) `
        -RedirectStandardOutput $cloudflaredStdout `
        -RedirectStandardError $cloudflaredStderr `
        -WindowStyle Hidden `
        -PassThru

    $startupDeadline = (Get-Date).AddSeconds(45)
    $publicUrl = $null

    do {
        if ($cloudflaredProcess.HasExited) {
            throw 'Cloudflare stopped before creating a Quick Tunnel. Run the launcher again in a few minutes.'
        }

        $cloudflaredOutput = @(
            Get-Content -LiteralPath $cloudflaredStdout -Raw -ErrorAction SilentlyContinue
            Get-Content -LiteralPath $cloudflaredStderr -Raw -ErrorAction SilentlyContinue
        ) -join [Environment]::NewLine

        if ($cloudflaredOutput -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
            $publicUrl = $Matches[0]
            break
        }

        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $startupDeadline)

    if (-not $publicUrl) {
        throw 'Cloudflare did not create a Quick Tunnel URL within 45 seconds.'
    }

    Write-Host 'Waiting for Cloudflare to publish and verify the public address...' -ForegroundColor Cyan
    Start-Sleep -Seconds 10

    $publicHost = ([Uri]$publicUrl).DnsSafeHost
    $encodedPublicHost = [Uri]::EscapeDataString($publicHost)
    $dnsCheckUrl = "https://cloudflare-dns.com/dns-query?name=${encodedPublicHost}&type=A"
    $dnsResult = Invoke-RestMethod `
        -Uri $dnsCheckUrl `
        -Headers @{ Accept = 'application/dns-json' } `
        -TimeoutSec 15

    if ($dnsResult.Status -ne 0 -or -not $dnsResult.Answer) {
        throw 'Cloudflare created a Quick Tunnel but did not publish its DNS record. This is a temporary TryCloudflare service problem; wait a few minutes, then run the launcher again.'
    }

    $publicHealth = Invoke-RestMethod -Uri "$publicUrl/api/hello.php" -TimeoutSec 20
    if ($publicHealth.status -ne 'success') {
        throw 'The public Cloudflare URL did not pass the PHP health check.'
    }

    Write-Host ''
    Write-Host 'Odidepse client preview is publicly reachable.' -ForegroundColor Green
    Write-Host $publicUrl -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'Meta Page webhook callback URL:'
    Write-Host "$publicUrl/api/facebook-webhook.php" -ForegroundColor Yellow
    Write-Host 'Update this callback in Meta and click Verify and save.'
    Write-Host ''
    Write-Host 'Send only the URL shown above to the client.'
    Write-Host 'Keep this window, computer, internet connection, and XAMPP MySQL running.'
    Write-Host 'Press Ctrl+C to stop sharing.'
    Write-Host ''

    Wait-Process -Id $cloudflaredProcess.Id

    $cloudflaredProcess.Refresh()
    if ($cloudflaredProcess.ExitCode -ne 0) {
        throw "Cloudflare stopped unexpectedly with exit code $($cloudflaredProcess.ExitCode)."
    }
}
finally {
    if ($cloudflaredProcess -and -not $cloudflaredProcess.HasExited) {
        Stop-Process -Id $cloudflaredProcess.Id -Force
    }

    if ($workerProcess -and -not $workerProcess.HasExited) {
        Stop-Process -Id $workerProcess.Id -Force
    }

    if ($phpProcess -and -not $phpProcess.HasExited) {
        Stop-Process -Id $phpProcess.Id -Force
    }

    foreach ($temporaryLog in @($cloudflaredStdout, $cloudflaredStderr)) {
        if ($temporaryLog -and (Test-Path -LiteralPath $temporaryLog -PathType Leaf)) {
            Remove-Item -LiteralPath $temporaryLog -Force -ErrorAction SilentlyContinue
        }
    }
}
