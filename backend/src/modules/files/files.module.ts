
import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { DriveService } from '../drive/drive.service';
import { PermissionService } from '../permissions/permission.service';
import { AuditService } from '../audit/audit.service';
import { ClamAvService } from '../security/clamav.service';
import { ForgeService } from '../drive/forge.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [FilesController],
  providers: [DriveService, PermissionService, AuditService, ClamAvService, ForgeService, PrismaService,
    { provide: 'REDIS', useFactory: () => { const Redis = require('ioredis'); return new Redis(process.env.REDIS_URL || 'redis://redis:6379'); } },
    { provide: 'PRISMA', useExisting: PrismaService }
  ],
  exports: [DriveService, PermissionService]
})
export class FilesModule {}
