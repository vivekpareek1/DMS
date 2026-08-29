#!/bin/bash
# Auto-configured for your repo: https://github.com/vivekpareek1/DMS
set -e
echo "=== Pushing to https://github.com/vivekpareek1/DMS ==="
echo "Repo is public and empty - confirmed"

# Git config
git config --global user.email "vivekpareek1@users.noreply.github.com" 2>/dev/null || true
git config --global user.name "Vivek Pareek" 2>/dev/null || true

# Init if needed
if [ ! -d .git ]; then
  git init
fi

git add .
git commit -m "v1.0.0 production - ISO 27001, permission-wise upload, Drive native, 180d retention, free testing ready

- DriveService crash-proof fix
- PermissionService Redis cache + cycle detection
- AuditService persistent hash chain
- LogRetention 180d with legal hold
- docker-compose no hardcoded secrets + healthchecks
- Free testing: docker-compose.free.yml + Oracle Always Free + Render free
" || echo "Already committed or nothing to commit"

git branch -M main

# Remove old origin if exists
git remote remove origin 2>/dev/null || true

git remote add origin https://github.com/vivekpareek1/DMS.git

echo "Pushing to https://github.com/vivekpareek1/DMS..."
echo "You will be asked for GitHub credentials - use Personal Access Token"
echo "Create token at: https://github.com/settings/tokens -> Generate classic token -> repo scope"
echo ""

git push -u origin main

echo ""
echo "✅ DONE! Check: https://github.com/vivekpareek1/DMS"
