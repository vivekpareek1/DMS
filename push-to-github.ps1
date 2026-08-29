
# 1-Click Push to GitHub - Windows PowerShell
Write-Host "=== Vault DMS - Push to GitHub ===" -ForegroundColor Green

$USERNAME = Read-Host "Enter your GitHub username"
$REPONAME = Read-Host "Enter repo name (default: vault-dms)"
if ([string]::IsNullOrWhiteSpace($REPONAME)) { $REPONAME = "vault-dms" }

Write-Host "Creating repo structure..." -ForegroundColor Yellow

if (-not (Test-Path ".git")) {
  git init
}

git add .
git commit -m "v1.0.0 production - ISO 27001, permission-wise upload, Drive native" -ErrorAction SilentlyContinue

git branch -M main

if (git remote | Select-String -Pattern "origin") {
  git remote remove origin
}

Write-Host ""
Write-Host "Now create GitHub repo at: https://github.com/new" -ForegroundColor Cyan
Write-Host "  - Name: $REPONAME" -ForegroundColor Cyan
Write-Host "  - Keep it empty" -ForegroundColor Cyan
Read-Host "Press ENTER after you created repo on GitHub"

git remote add origin "https://github.com/$USERNAME/$REPONAME.git"

Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin main

Write-Host ""
Write-Host "DONE! Repo: https://github.com/$USERNAME/$REPONAME" -ForegroundColor Green
