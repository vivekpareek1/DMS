
# Vault DMS - Enterprise Document Management System
Google Drive Native | Excel + AutoCAD | Permission-wise Upload

![License](https://img.shields.io/badge/license-MIT-green)
![Stack](https://img.shields.io/badge/stack-NestJS%20%2B%20NextJS%20%2B%20Postgres-blue)

## Features Implemented (All Integrations Complete)
- ✅ Google Drive as ONLY storage (resumable upload, 500MB files)
- ✅ Permission-wise Upload (canEdit = upload permission)
- ✅ Excel Viewer/Editor (Univer Sheet) + DWG Viewer (Autodesk Forge)
- ✅ Folder & File level permissions with inheritance
- ✅ Versioning, Audit Logs, File Locking, OCR Search
- ✅ Admin Portal, User Management, Role Matrix
- ✅ Virus Scan (ClamAV), Thumbnails, Background Workers

## Quick Start (GitHub -> Local -> Server)

### 1. Clone
```bash
git clone https://github.com/YOUR_USERNAME/vault-dms.git
cd vault-dms
```

### 2. Setup Env
```bash
cp backend/.env.template backend/.env
cp frontend/.env.template frontend/.env
# Edit backend/.env with DRIVE_ROOT_FOLDER_ID + GOOGLE_SERVICE_ACCOUNT_JSON
```

### 3. Run with Docker (Recommended)
```bash
docker-compose -f deploy/docker-compose.yml up -d --build
docker-compose -f deploy/docker-compose.yml exec backend npx prisma migrate deploy
docker-compose -f deploy/docker-compose.yml exec backend npm run drive:sync
```

### 4. Run Without Docker (Dev)
```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run dev # http://localhost:3001

# Frontend
cd frontend
npm install
npm run dev # http://localhost:3000

# Worker
cd backend
npm run worker
```

## Section-Wise Testing
See `deploy/DEPLOY_GUIDE.md` for section-wise testing checklist.

## Folder Structure
```
vault-dms/
├── backend/          # NestJS + Prisma + Google Drive + BullMQ
├── frontend/         # Next.js 14 + Univer Sheet + Forge Viewer
├── deploy/           # Docker, Nginx, Env template, Deploy guide
└── README.md
```

## Deploy to Server
See `deploy/DEPLOY_GUIDE.md` for minimum server requirements and 10-min deploy.

## Google Drive Setup
1. Create Service Account in GCP Console
2. Share your Drive root folder with service account email (Editor)
3. Put JSON in backend/.env as GOOGLE_SERVICE_ACCOUNT_JSON
4. Set DRIVE_ROOT_FOLDER_ID from Drive URL

## Permission Model
- canView = can see file
- canDownload = can download
- canEdit = can UPLOAD + edit (this is upload permission)
- canDelete = can delete
- canManagePerms = can assign permissions

## Support
Contact: Vivek Pareek - For testing section-wise
