
import { Module } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PrismaService } from '../../prisma.service';
@Module({
  providers: [PermissionService, PrismaService,
    { provide: 'REDIS', useFactory: () => { const Redis = require('ioredis'); return new Redis(process.env.REDIS_URL || 'redis://redis:6379'); } }
  ],
  exports: [PermissionService]
})
export class PermissionsModule {}
