
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { FilesModule } from './modules/files/files.module';
import { DriveModule } from './modules/drive/drive.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { AuditModule } from './modules/audit/audit.module';
import { SecureHeadersGuard } from './common/guards/secure-headers.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 20, // 20 requests per minute per user - best for DWG upload
    }]),
    FilesModule,
    DriveModule,
    PermissionsModule,
    AuditModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // P1: Rate limiting
    { provide: APP_GUARD, useClass: SecureHeadersGuard }, // P0: Security headers
  ],
})
export class AppModule {}
