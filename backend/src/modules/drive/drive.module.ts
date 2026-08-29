
import { Module } from '@nestjs/common';
import { DriveService } from './drive.service';
import { ForgeService } from './forge.service';
import { PrismaService } from '../../prisma.service';
@Module({
  providers: [DriveService, ForgeService, PrismaService],
  exports: [DriveService, ForgeService]
})
export class DriveModule {}
