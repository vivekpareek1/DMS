
import { Controller, Post, Get, Param, UseGuards, Inject, Req, UploadedFile, UseInterceptors, Body, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DriveService } from '../drive/drive.service';
import { PermissionService } from '../permissions/permission.service';
import { AuditService } from '../audit/audit.service';
import { ClamAvService } from '../security/clamav.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  private readonly logger = new Logger(FilesController.name);
  constructor(
    private driveService: DriveService,
    private permissionService: PermissionService,
    private auditService: AuditService,
    private clamavService: ClamAvService,
    @Inject('PRISMA') private prisma: any,
    @Inject('REDIS') private redis: any
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: '/tmp/uploads',
      filename: (req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safe}`);
      }
    }),
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max for DWG
    fileFilter: (req, file, cb) => {
      const allowedExt = ['.dwg','.dxf','.xlsx','.xls','.pdf','.jpg','.jpeg','.png'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedExt.includes(ext)) {
        return cb(new BadRequestException(`File type ${ext} not allowed. Allowed: ${allowedExt.join(', ')}`), false);
      }
      cb(null, true);
    }
  }))
  async upload(@UploadedFile() file: Express.Multer.File, @Body() body: { folderId: string }, @Req() req: any) {
    const user = req.user; // From JwtAuthGuard
    if (!body.folderId) throw new BadRequestException('folderId required');

    // P0 FIX: Permission check - canEdit = upload permission
    const canUpload = await this.permissionService.can(user.id, body.folderId, 'canEdit', true);
    if (!canUpload) {
      throw new ForbiddenException(`User ${user.email} has no upload permission for folder ${body.folderId}`);
    }

    // Check file lock if updating existing? For new file, no lock needed
    const folder = await this.prisma.folder.findUnique({ where: { id: body.folderId } });
    if (!folder) throw new NotFoundException('Folder not found');

    try {
      // 1. Virus scan (ClamAV) - blocks the request if infected, throws BadRequestException
      await this.clamavService.scanFile(file.path);

      // 2. Upload to Drive - P0 fixed resumable
      const driveFile = await this.driveService.uploadResumable(folder.driveFolderId, file.path, file.originalname);

      // 3. Create DB records
      const dbFile = await this.prisma.file.create({
        data: {
          name: file.originalname,
          driveFileId: driveFile.id!,
          mimeType: driveFile.mimeType || file.mimetype,
          size: BigInt(driveFile.size || file.size),
          md5: (driveFile as any).md5Checksum,
          folderId: body.folderId,
        }
      });

      await this.prisma.fileVersion.create({
        data: {
          fileId: dbFile.id,
          version: 1,
          driveFileId: driveFile.id!,
          size: BigInt(driveFile.size || file.size),
          createdById: user.id,
          comment: 'Initial upload'
        }
      });

      // 4. Audit log with hash chaining (P0 fixed persistent)
      await this.auditService.log(this.prisma, {
        userId: user.id,
        userEmail: user.email,
        action: 'FILE_UPLOAD',
        fileId: dbFile.id,
        details: { fileName: file.originalname, driveFileId: driveFile.id, size: file.size },
        ip: req.ip
      });

      // 5. Invalidate permission cache
      await this.permissionService.invalidateCache(user.id, body.folderId);

      this.logger.log(`File uploaded: ${dbFile.id} by ${user.email}`);
      return { fileId: dbFile.id, driveFileId: driveFile.id, version: 1, name: file.originalname };

    } finally {
      // Cleanup temp file
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, () => {});
      }
    }
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    const canDownload = await this.permissionService.can(user.id, id, 'canDownload');
    if (!canDownload) throw new ForbiddenException('No download permission');

    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');

    await this.auditService.log(this.prisma, {
      userId: user.id, userEmail: user.email, action: 'FILE_DOWNLOAD', fileId: id, ip: req.ip
    });

    // Stream from Drive - return signed URL or proxy
    return { downloadUrl: `https://drive.google.com/uc?id=${file.driveFileId}`, fileName: file.name };
  }

  @Post(':id/lock')
  async lock(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    const canEdit = await this.permissionService.can(user.id, id, 'canEdit');
    if (!canEdit) throw new ForbiddenException('No edit permission to lock');

    // Redis NX lock 30min
    const lockKey = `lock:file:${id}`;
    const locked = await this.redis?.set(lockKey, user.id, 'EX', 1800, 'NX');
    if (!locked) {
      const owner = await this.redis?.get(lockKey);
      throw new BadRequestException(`File already locked by ${owner}`);
    }

    await this.prisma.file.update({
      where: { id },
      data: { isLocked: true, lockedById: user.id, lockedAt: new Date() }
    });

    return { locked: true, lockedBy: user.id, expiresIn: 1800 };
  }

  @Post(':id/unlock')
  async unlock(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    const lockKey = `lock:file:${id}`;
    const owner = await this.redis?.get(lockKey);
    if (owner && owner !== user.id) {
      // Check admin override
      const isAdmin = await this.prisma.userRole.findFirst({ where: { userId: user.id, role: { name: 'ADMIN' } } });
      if (!isAdmin) throw new ForbiddenException('Only lock owner or admin can unlock');
    }
    await this.redis?.del(lockKey);
    await this.prisma.file.update({ where: { id }, data: { isLocked: false, lockedById: null, lockedAt: null } });
    return { unlocked: true };
  }
}
