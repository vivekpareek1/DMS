
import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';
import * as fs from 'fs';

@Injectable()
export class DriveService {
  private drive: drive_v3.Drive;
  private readonly logger = new Logger(DriveService.name);
  
  constructor() {
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!saJson) {
      throw new Error('CRITICAL: Missing GOOGLE_SERVICE_ACCOUNT_JSON env - refusing to start');
    }
    let credentials: any;
    try {
      credentials = JSON.parse(saJson);
      if (!credentials.client_email || !credentials.private_key) {
        throw new Error('SA JSON missing client_email/private_key');
      }
    } catch (e) {
      throw new Error(`Invalid GOOGLE_SERVICE_ACCOUNT_JSON: ${(e as Error).message}`);
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    this.drive = google.drive({ version: 'v3', auth });
    this.logger.log('DriveService initialized for ' + credentials.client_email);
  }

  async uploadResumable(folderDriveId: string, filePath: string, name: string) {
    if (!folderDriveId || folderDriveId.trim() === '') {
      throw new InternalServerErrorException('folderDriveId is required - prevents root pollution');
    }
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Temp file missing at ${filePath}`);
    }

    return this.withRetry(async () => {
      const stream = fs.createReadStream(filePath);
      // P0 FIX: stream error handler
      stream.on('error', (err) => {
        this.logger.error(`ReadStream error for ${name}: ${err.message}`);
        throw new InternalServerErrorException(`File read failed: ${err.message}`);
      });

      try {
        const res = await this.drive.files.create({
          requestBody: { 
            name: this.sanitizeFileName(name), 
            parents: [folderDriveId] 
          },
          media: { 
            mimeType: this.getMime(name), 
            body: stream 
          },
          fields: 'id, name, size, md5Checksum, mimeType, parents',
          supportsAllDrives: true,
        });
        this.logger.log(`Uploaded ${name} -> driveFileId ${res.data.id}`);
        return res.data;
      } finally {
        stream.destroy();
      }
    });
  }

  async getChanges(pageToken: string) {
    const res = await this.drive.changes.list({
      pageToken,
      fields: 'changes(fileId,file(id,name,mimeType,parents,trashed)),newStartPageToken,nextPageToken',
      pageSize: 100,
      supportsAllDrives: true,
    });
    return res.data;
  }

  async getStartPageToken() {
    const res = await this.drive.changes.getStartPageToken({ supportsAllDrives: true });
    return res.data.startPageToken!;
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
    try { 
      return await fn(); 
    } catch (e: any) {
      const message = e.message || '';
      const isRateLimit = e.code === 429 || (e.code === 403 && /rateLimitExceeded|userRateLimitExceeded|quotaExceeded/i.test(message));
      const isAuthError = e.code === 403 && /insufficient|accessNotConfigured|forbidden/i.test(message);
      
      if (isAuthError) {
        this.logger.error(`Drive auth error - NOT retrying: ${message}`);
        throw e;
      }
      
      if (isRateLimit && retries > 0) {
        const delay = Math.pow(2, 6 - retries) * 1000 + Math.random() * 1000;
        this.logger.warn(`Rate limited, retrying in ${delay}ms (${retries} left)`);
        await new Promise(r => setTimeout(r, delay));
        return this.withRetry(fn, retries - 1);
      }
      throw e;
    }
  }

  private getMime(name: string): string {
    const lower = name.toLowerCase();
    if (lower.endsWith('.dwg')) return 'application/acad';
    if (lower.endsWith('.dxf')) return 'application/dxf';
    if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    return 'application/octet-stream';
  }

  private sanitizeFileName(name: string): string {
    // Prevent path traversal and control chars
    return name.replace(/[\\/<>:"|?*\x00-\x1F]/g, '_').substring(0, 255);
  }
}
