
# Vault DMS v1.0.0 - Production Ready
**Google Drive Native | Permission-wise Upload | ISO 27001 Compliant**

## 🚀 Quick Deploy (Best Decision - Hetzner CX32 $28/mo)

```bash
# 1. Clone production branch
git clone -b security-fixes https://github.com/YOUR_USERNAME/vault-dms.git
cd vault-dms

# 2. Generate secrets (CRITICAL - never use defaults)
echo "DB_PASSWORD=$(openssl rand -base64 32)" > deploy/.env
echo "JWT_SECRET=$(openssl rand -base64 48)" >> deploy/.env
echo "ALLOWED_ORIGINS=https://dms.yourdomain.com" >> deploy/.env
# Add DRIVE_ROOT_FOLDER_ID and GOOGLE_SERVICE_ACCOUNT_JSON to deploy/.env

# 3. Deploy
cd deploy && chmod +x deploy.sh && ./deploy.sh

# 4. Verify
curl http://localhost:3001/api/health
# Expected: {"status":"ok","db":"ok","redis":"ok","drive":"configured","retention":"180d"}
```

## ✅ What is Production Ready?

### P0 Critical Fixes (Applied)
- **DriveService**: No crash on invalid JSON, stream error handling, rate-limit only retry, case-insensitive MIME, filename sanitization
- **PermissionService**: Redis cache (60s) + invalidation, cycle detection (max 50 depth), NotFound vs Forbidden, DENY wins
- **AuditService**: Persistent lastHash from DB (not memory), GDPR pseudonymization, verifyChain()
- **LogRetention**: Named advisory lock hashtext(), strict regex, UTC 180d cutoff, legal hold
- **docker-compose**: No hardcoded secrets, healthchecks, required env validation
- **main.ts**: CORS whitelist (not origin:*), Helmet, ValidationPipe

### P1 Production Hardening (Best Decision)
- Rate limiting 20 req/min per user (prevents Drive quota exhaustion)
- ClamAV virus scan with fail-open (best UX, logged)
- Forge DWG translation with SVG fallback
- BullMQ thumbnail workers (async, doesn't block API)
- Complete module wiring

## 📁 Features

- **Upload**: Permission-wise (canEdit=upload), 500MB max, resumable 8MB chunks, directly to Drive
- **View**: Excel (Univer Sheet), DWG (Autodesk Forge + SVG fallback), PDF, images
- **Security**: ISO 27001 A.12.4, GDPR Art 5, 180-day retention, legal hold, audit hash chain
- **Admin**: User/role matrix, folder/file ACL with inheritance, audit logs

## 🔧 Section-wise Testing

```bash
# Section 1 - Auth
curl -X POST http://localhost:3001/api/auth/login -d '{"email":"admin@test.com","password":"..."}'

# Section 2 - Drive Sync
docker-compose exec backend npm run drive:dry-run
docker-compose exec backend npm run drive:sync

# Section 3 - Permission-wise Upload
# Login as viewer -> POST /api/files/upload should 403
# Login as manager -> upload to /Projects OK, /Scanned 403

# Section 4 - DWG Preview
curl http://localhost:3001/api/files/:id/preview # returns SVG URL

# Section 5 - Retention
docker-compose exec postgres psql -U vault -c "INSERT INTO \"AuditLog\" (\"userId\",\"userEmail\",\"action\",\"createdAt\") VALUES ('test','a@b.com','TEST', NOW() - INTERVAL '181 days')"
# Wait for cron or run manually, then verify deleted
```

## 📊 Minimum Server Requirements

| Users | CPU | RAM | Disk | Cost | Provider |
|-------|-----|-----|------|------|----------|
| 50 | 4 vCPU | 16GB | 100GB SSD | $28/mo | Hetzner CX32 |
| 500 | 8 vCPU | 32GB | 500GB NVMe + GCS | $120/mo | GCP |

**Do NOT use 2GB RAM** - DWG conversion needs 2GB per job.

## 🔐 Security Checklist

- [x] No hardcoded secrets
- [x] CORS whitelist
- [x] Helmet headers
- [x] Rate limiting
- [x] Audit hash chain
- [x] 180d retention
- [x] GDPR pseudonymization
- [x] Virus scan
- [x] Filename sanitization

## 📦 Production Zip

Download: `vault-dms-v1.0.0-PRODUCTION-READY.zip` - Ready to push to GitHub.

---

**Best decision**: Deploy on Hetzner CX32, use Drive native storage, permission-wise upload with canEdit, 180d retention with legal hold.
