
Write-Host "Pushing to https://github.com/vivekpareek1/DMS" -ForegroundColor Green

if (-not (Test-Path ".git")) { git init }

git add .
git commit -m "v1.0.0 production" -ErrorAction SilentlyContinue
git branch -M main
git remote remove origin 2>$null
git remote add origin "https://github.com/vivekpareek1/DMS.git"

Write-Host "Pushing... Use GitHub Personal Access Token as password" -ForegroundColor Yellow
Write-Host "Create token: https://github.com/settings/tokens" -ForegroundColor Cyan

git push -u origin main

Write-Host "Done! Check https://github.com/vivekpareek1/DMS" -ForegroundColor Green
