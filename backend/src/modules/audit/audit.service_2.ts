
import { Injectable, Logger } from '@nestjs/common';
import { auditLogHashChain, secureLogger } from '../../common/logger/secure-logger.service';
import * as crypto from 'crypto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  async log(prisma: any, data: { userId: string, userEmail: string, action: string, fileId?: string, folderId?: string, details?: any, ip?: string }) {
    // P0 FIX: Get last hash from DB, not memory - persists across restarts
    const lastRecord = await prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { hash: true }
    });
    const prevHash = lastRecord?.hash || 'GENESIS';

    const payload = {
      userId: data.userId,
      action: data.action,
      fileId: data.fileId,
      folderId: data.folderId,
      timestamp: new Date().toISOString(),
      prevHash
    };
    const currentHash = auditLogHashChain(prevHash, payload);
    
    // GDPR pseudonymization
    const hashedEmail = crypto.createHash('sha256').update(data.userEmail.toLowerCase()).digest('hex').substring(0, 16) + '@redacted';
    const hashedIp = data.ip ? crypto.createHash('sha256').update(data.ip).digest('hex').substring(0, 16) : null;

    // Sanitize details - never log secrets
    let safeDetails = data.details;
    if (safeDetails) {
      const str = JSON.stringify(safeDetails);
      if (/password|token|service_account|private_key|client_secret/i.test(str)) {
        safeDetails = { redacted: true, reason: 'Sensitive data removed' };
      }
    }

    try {
      const record = await prisma.auditLog.create({
        data: {
          userId: data.userId,
          userEmail: hashedEmail,
          action: data.action,
          fileId: data.fileId,
          folderId: data.folderId,
          details: safeDetails,
          ip: hashedIp,
          hash: currentHash,
          prevHash: prevHash
        } as any
      });
      secureLogger.info('AUDIT', { action: data.action, userId: data.userId, fileId: data.fileId, hash: currentHash.substring(0, 8) });
      return record;
    } catch (e) {
      this.logger.error(`Audit log failed: ${(e as Error).message}`, { action: data.action });
      throw e;
    }
  }

  // Verify chain integrity - for ISO audit
  async verifyChain(prisma: any): Promise<{ valid: boolean, brokenAt?: string }> {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' }, select: { hash: true, prevHash: true, id: true } });
    let prev = 'GENESIS';
    for (const log of logs) {
      if (log.prevHash !== prev) {
        return { valid: false, brokenAt: log.id };
      }
      prev = log.hash;
    }
    return { valid: true };
  }
}
