
# P0 Security Fixes Applied - 2026-05-13
Branch: security-fixes

## Fixed:
1. DriveService JSON.parse crash - try/catch + validation
2. DriveService stream error handler + folderDriveId validation
3. DriveService withRetry - no retry on auth errors, only rate limit
4. DriveService getMime case-insensitive + sanitizeFileName
5. PermissionService Redis cache implemented + invalidation
6. PermissionService cycle detection with visited Set + max depth 50
7. PermissionService NotFound vs Forbidden + proper evaluate DENY wins
8. FilesController REAL implementation (was stub) with fileFilter, 500MB limit, permission check canEdit=upload
9. FilesController lock with Redis NX 30min + admin override
10. AuditService persistent lastHash from DB not memory
11. LogRetentionService named advisory lock hashtext() not magic number
12. LogRetentionService stricter regex app-YYYY-MM-DD.log + UTC handling
13. main.ts CORS whitelist not origin:true + ValidationPipe + helmet
14. docker-compose no hardcoded secrets + healthchecks + required env validation
15. Added PrismaService with connect/disconnect hooks

## Verification:
- npm run test -> 6/6 retention tests pass
- docker-compose config -> validates no hardcoded secrets
- npm run build -> no TS errors

## Next: P1 items in next sprint
