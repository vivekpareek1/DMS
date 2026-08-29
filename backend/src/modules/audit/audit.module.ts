
import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { LogRetentionService } from './log-retention.service';
import { PrismaService } from '../../prisma.service';
@Module({
  providers: [AuditService, LogRetentionService, PrismaService],
  exports: [AuditService, LogRetentionService]
})
export class AuditModule {}
