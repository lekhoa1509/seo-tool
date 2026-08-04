$ErrorActionPreference = 'Stop'
$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoDir

Write-Host "=== SEO Pro Tool - Deploy ===" -ForegroundColor Blue
Write-Host ""

$status = git status --porcelain
if ([string]::IsNullOrEmpty($status)) {
    Write-Host "Khong co thay doi nao de commit." -ForegroundColor Yellow
    $pushOnly = Read-Host "Push commit hien tai len GitHub? (y/n)"
    if ($pushOnly -ne 'y') {
        Write-Host "Huy deploy."
        exit 0
    }
} else {
    Write-Host "Cac file thay doi:" -ForegroundColor Yellow
    git status --short
    Write-Host ""

    if ($args.Count -gt 0) {
        $Msg = $args[0]
    } else {
        $Msg = Read-Host "Nhap commit message (Enter de dung mac dinh)"
        if ([string]::IsNullOrEmpty($Msg)) {
            $Msg = "deploy: update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        }
    }

    git add -A
    git commit -m "$Msg"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "Committed: $Msg" -ForegroundColor Green
}

Write-Host ""
Write-Host "Dang push len GitHub..." -ForegroundColor Blue
git push origin main
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Pushed to GitHub" -ForegroundColor Green

Write-Host ""
Write-Host "=== Deploy dang chay ===" -ForegroundColor Green
Write-Host "  Railway (backend) tu build tu GitHub push"
Write-Host "  Vercel  (frontend) tu build tu GitHub push"
Write-Host ""
Write-Host "Theo doi:" -ForegroundColor Blue
Write-Host "  Backend logs : https://railway.app"
Write-Host "  Frontend logs: https://vercel.com/dashboard"
Write-Host "  Health check : https://seo-tool-production-99c0.up.railway.app/health"
Write-Host ""
Write-Host "Thuong mat 1-3 phut de deploy xong." -ForegroundColor Yellow
