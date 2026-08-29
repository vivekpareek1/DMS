#!/bin/bash
# 1-Click Push to GitHub - Run this on YOUR laptop after downloading zip

set -e

echo "=== Vault DMS - Push to GitHub ==="
echo ""

# Check if git exists
if ! command -v git &> /dev/null; then
  echo "Git not found. Install git first: https://git-scm.com/downloads"
  exit 1
fi

read -p "Enter your GitHub username: " USERNAME
read -p "Enter repo name (default: vault-dms): " REPONAME
REPONAME=${REPONAME:-vault-dms}

echo ""
echo "Creating repo structure..."

# Initialize if not already git repo
if [ ! -d .git ]; then
  git init
fi

git add .
git commit -m "v1.0.0 production - ISO 27001, permission-wise upload, Drive native, 180d retention, free testing ready" || echo "Already committed"

git branch -M main

# Check if remote exists
if git remote | grep -q origin; then
  git remote remove origin
fi

echo ""
echo "Now create GitHub repo at: https://github.com/new"
echo "  - Name: $REPONAME"
echo "  - Keep it empty (don't add README)"
echo "  - Click Create"
echo ""
read -p "Press ENTER after you created the repo on GitHub..."

git remote add origin https://github.com/$USERNAME/$REPONAME.git

echo ""
echo "Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ DONE! Repo pushed to https://github.com/$USERNAME/$REPONAME"
echo ""
echo "Next steps for FREE testing:"
echo "  1. GitHub Codespaces: Go to repo -> Code -> Codespaces -> Create (free 60hrs)"
echo "  2. Render: Go to render.com -> New Blueprint -> Connect $REPONAME repo -> Free URL"
echo "  3. Local: cd deploy && docker-compose -f docker-compose.free.yml up -d"
echo ""
echo "Your app is live for testing!"
