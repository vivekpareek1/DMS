
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    const checks: any = { status: 'ok', timestamp: new Date().toISOString() };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.db = 'ok';
    } catch { checks.db = 'fail'; checks.status = 'degraded'; }
    
    try {
      const redis = new (require('ioredis'))(process.env.REDIS_URL || 'redis://redis:6379');
      await redis.ping();
      checks.redis = 'ok';
      await redis.quit();
    } catch { checks.redis = 'fail'; }

    checks.drive = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? 'configured' : 'missing';
    checks.retention = `${process.env.LOG_RETENTION_DAYS || 180}d`;
    checks.version = 'v1.0.0-production';
    
    return checks;
  }

  @Get('audit-chain')
  async verifyAuditChain() {
    const auditService = new (require('../audit/audit.service').AuditService)();
    return auditService.verifyChain(this.prisma);
  }
}
