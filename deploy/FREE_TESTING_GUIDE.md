
# FREE Options for Testing Vault DMS

## Option 1: LOCAL DOCKER (100% FREE, No Card, Best for Testing)
**Time: 5 minutes | Cost: $0 | RAM: 2GB needed**

```bash
# On your laptop (Windows/Mac/Linux):
git clone https://github.com/YOUR_USERNAME/vault-dms.git
cd vault-dms/deploy

# Create .env with your Drive credentials (free)
echo 'DRIVE_ROOT_FOLDER_ID=YOUR_FOLDER_ID' > .env
echo "GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'" >> .env
echo "DB_PASSWORD=freepassword123" >> .env
echo "JWT_SECRET=free-testing-jwt-secret-32-chars-min" >> .env

# Run FREE tier (low RAM)
docker-compose -f docker-compose.free.yml up -d --build

# Open:
# Frontend: http://localhost:3000
# Backend: http://localhost:3001/api/health
```

**Pros:** Instant, free, full control, no sleep
**Cons:** Only you can access, need laptop on

---

## Option 2: ORACLE CLOUD ALWAYS FREE (100% FREE FOREVER, No Card? Needs Card but $0)
**Best for public testing | 4 vCPU ARM + 24GB RAM + 200GB disk - FREE FOREVER**

Oracle gives you ALWAYS FREE VM:
- 4 OCPUs ARM Ampere
- 24 GB RAM
- 200 GB storage
- No expiry - FREE FOREVER

Steps:
1. Go to https://www.oracle.com/cloud/free/ -> Sign up (needs card but $0 charged, 1$ verification)
2. Create Compute Instance -> Ampere ARM, 4 CPU, 24GB RAM, Ubuntu 22.04
3. Open ports 3000, 3001, 22 in Security List
4. SSH:
```bash
sudo apt update && sudo apt install docker.io docker-compose git -y
git clone https://github.com/YOUR_USERNAME/vault-dms.git
cd vault-dms/deploy
nano .env # add your Drive creds
docker-compose -f docker-compose.yml up -d --build
```
5. Access: http://YOUR_ORACLE_PUBLIC_IP:3000

**Pros:** FREE FOREVER, 24GB RAM can handle DWG conversion, public URL
**Cons:** Needs card for verification (but $0)

---

## Option 3: RENDER.COM FREE TIER (100% FREE, No Card)
**Best for quick shareable link**

Render gives:
- Web Service free (750 hrs/month, sleeps after 15 min)
- Postgres free (90 days, then delete - but ok for testing)
- Redis free via Upstash

Steps:
1. Go to https://render.com -> Sign up with GitHub (no card)
2. New -> Blueprint -> Connect your vault-dms repo
3. Render will detect docker-compose.yml (or use render.yaml we provide)
4. Add env vars in Render dashboard: DRIVE_ROOT_FOLDER_ID, GOOGLE_SERVICE_ACCOUNT_JSON
5. Deploy -> Free URL: https://vault-dms.onrender.com

**Pros:** No card, free public URL, auto deploy from GitHub
**Cons:** Sleeps after 15 min (wakes in 30s), Postgres deleted after 90 days

---

## Option 4: GITHUB CODESPACES (FREE 60 HRS/MONTH, No Card)
**Best for dev testing without installing Docker**

1. Go to your GitHub repo -> Code -> Codespaces -> Create codespace
2. In terminal:
```bash
cd deploy
docker-compose -f docker-compose.free.yml up -d --build
```
3. Codespaces auto-forwards ports 3000 and 3001 -> Click to open

**Pros:** No local install, free 60 hrs/month, VS Code in browser
**Cons:** Limited hours, not public

---

## Option 5: FLY.IO FREE TIER (Free $5 credit)
**Fly gives $5 free credit = ~1 month small VM**

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh
fly auth signup # free $5 credit
fly launch # from repo root
fly secrets set GOOGLE_SERVICE_ACCOUNT_JSON='...' DRIVE_ROOT_FOLDER_ID=...
fly deploy
```

---

## RECOMMENDED FOR YOU: Option 1 + Option 2

**For immediate testing (today): Use Option 1 LOCAL DOCKER - 5 min, $0**

**For public testing with team (free forever): Use Option 2 ORACLE CLOUD**

Oracle Free is best because:
- 24GB RAM vs Render 512MB (your DWG needs 2GB)
- Never sleeps (Render sleeps)
- Free forever (Render Postgres deletes after 90 days)
- India region (Mumbai) available -> low latency for you

---

## FREE Google Drive Setup (You already have this)

Your app uses Google Drive as storage - Drive is free 15GB.
For service account:
1. Go to console.cloud.google.com (free)
2. Create service account (free)
3. Share your Drive folder with service account email (free)
4. No billing needed for Drive API (free quota 1B requests/day)

---

## How to Test Permission-wise Upload FREE

After deploying any free option:

1. Open http://localhost:3000 or your free URL
2. Login as admin / admin123
3. Create users: manager@test.com (Editor), viewer@test.com (Viewer)
4. Create folder /Projects
5. Assign: manager -> canEdit ON, viewer -> canEdit OFF
6. Login as viewer -> Try upload -> Should show ⛔ "No upload permission" (permission-wise working!)
7. Login as manager -> Upload works, goes to Drive

---

## Cost Comparison

| Option | Cost | RAM | Sleep? | Public? | Card Needed? |
|--------|------|-----|--------|---------|--------------|
| Local Docker | $0 | Your laptop | No | No | No |
| Oracle Always Free | $0 forever | 24GB | No | Yes | Yes (verif $1, refunded) |
| Render Free | $0 | 512MB | Yes (15min) | Yes | No |
| Codespaces | $0 (60hrs) | 4GB | Yes | No | No |
| Fly.io | $5 free credit | 256MB | No | Yes | No |

**Best for you: Oracle Free (if you have card) else Render Free or Local Docker**
