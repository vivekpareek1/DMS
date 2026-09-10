
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FilesController } from './files.controller';
import { DriveService } from '../drive/drive.service';
import { PermissionService } from '../permissions/permission.service';
import { AuditService } from '../audit/audit.service';
import { ClamAvService } from '../security/clamav.service';
import { ForgeService } from '../drive/forge.service';
import { PrismaService } from '../../prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '8h' } }),
  ],
  controllers: [FilesController],
  providers: [DriveService, PermissionService, AuditService, ClamAvService, ForgeService, PrismaService, JwtAuthGuard,
    { provide: 'REDIS', useFactory: () => { const Redis = require('ioredis'); return new Redis(process.env.REDIS_URL || 'redis://redis:6379'); } },
    { provide: 'PRISMA', useExisting: PrismaService }
  ],
  exports: [DriveService, PermissionService]
})
export class FilesModule {}
