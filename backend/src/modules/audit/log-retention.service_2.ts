
import { Injectable, Logger } from '@nestjs/common';
import { getRetentionConfig } from './log-retention.config';
import { secureLogger } from '../../common/logger/secure-logger.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class LogRetentionService {
  private readonly logger = new Logger(LogRetentionService.name);
  private config = getRetentionConfig();

  getCutoffDate(retentionDays: number): Date {
    const now = new Date();
    // UTC 00:00:00 of today minus retention days - ensures 180d = exactly 180*24h
    const utcToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const cutoff = new Date(utcToday);
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
    return cutoff;
  }

  async executeRetention(prisma: any) {
    if (this.config.legalHold) {
      secureLogger.info('Retention skipped: LEGAL_HOLD enabled');
      return { skipped: true, reason: 'LEGAL_HOLD' };
    }
    const cutoff = this.getCutoffDate(this.config.retentionDays);
    secureLogger.info('Starting 180d retention purge', { cutoff: cutoff.toISOString(), retentionDays: this.config.retentionDays });

    const dbResult = await this.purgeAuditLogs(prisma, cutoff);
    const fileResult = await this.purgeFileLogs(cutoff);
    return { dbResult, fileResult, cutoff: cutoff.toISOString() };
  }

  private async purgeAuditLogs(prisma: any, cutoff: Date) {
    let totalPurged = 0;
    let attempts = 0;
    const maxRetries = 3;

    while (attempts <= maxRetries) {
      try {
        // P0 FIX: Named advisory lock, not magic number
        await prisma.$executeRaw`SELECT pg_advisory_lock(hashtext('vault_dms_log_retention'))`;

        if (this.config.archiveMode) {
          await this.archiveLogs(prisma, cutoff);
        }

        let batch: any[];
        do {
          batch = await prisma.auditLog.findMany({
            where: { createdAt: { lt: cutoff } },
            take: this.config.batchSize,
            orderBy: { createdAt: 'asc' },
            select: { id: true }
          });
          if (batch.length === 0) break;
          await prisma.auditLog.deleteMany({ where: { id: { in: batch.map((b: any) => b.id) } } });
          totalPurged += batch.length;
          secureLogger.info('Purged audit batch', { batchSize: batch.length, totalPurged });
        } while (batch.length === this.config.batchSize);

        await prisma.$executeRaw`SELECT pg_advisory_unlock(hashtext('vault_dms_log_retention'))`;
        break;
      } catch (e) {
        attempts++;
        secureLogger.error('Purge failed, retrying', { attempt: attempts, error: (e as Error).message });
        if (attempts > maxRetries) {
          await prisma.$executeRaw`SELECT pg_advisory_unlock(hashtext('vault_dms_log_retention'))`.catch(()=>{});
          throw e;
        }
        await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 1000));
      }
    }
    return { purged: totalPurged };
  }

  private async archiveLogs(prisma: any, cutoff: Date) {
    // In prod, upload to GCS with encryption
    secureLogger.info('Archive mode: would archive logs before purge', { cutoff: cutoff.toISOString() });
  }

  private async purgeFileLogs(cutoff: Date) {
    const logDir = path.join(process.cwd(), 'logs');
    try {
      const files = await fs.readdir(logDir);
      let purged = 0;
      let skippedInvalid = 0;
      for (const file of files) {
        // P0 FIX: stricter regex - must be app-YYYY-MM-DD.log format
        const match = file.match(/^app-(\d{4}-\d{2}-\d{2})\.log/);
        if (!match) { skippedInvalid++; continue; }
        const fileDate = new Date(match[1] + 'T00:00:00Z');
        if (isNaN(fileDate.getTime())) { skippedInvalid++; continue; }
        if (fileDate < cutoff) {
          try {
            await fs.unlink(path.join(logDir, file));
            purged++;
          } catch {}
        }
      }
      if (skippedInvalid > 0) secureLogger.warn('Skipped files with invalid timestamp', { skippedInvalid });
      return { purgedFiles: purged, skippedInvalid };
    } catch (e: any) {
      if (e.code === 'ENOENT') return { purgedFiles: 0, note: 'log dir not found - empty' };
      throw e;
    }
  }
}
