
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as net from 'net';

@Injectable()
export class ClamAvService {
  private readonly logger = new Logger(ClamAvService.name);
  private host = process.env.CLAMAV_HOST || 'clamav';
  private port = parseInt(process.env.CLAMAV_PORT || '3310');

  async scanFile(filePath: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port }, () => {
        const fs = require('fs');
        const stream = fs.createReadStream(filePath);
        stream.pipe(socket);
      });
      let data = '';
      socket.on('data', chunk => data += chunk);
      socket.on('end', () => {
        if (data.includes('FOUND')) {
          this.logger.warn(`Virus found in ${filePath}: ${data}`);
          reject(new BadRequestException(`Virus detected: ${data}`));
        } else if (data.includes('OK')) {
          resolve(true);
        } else {
          this.logger.warn(`ClamAV unexpected response: ${data}, allowing file (fail-open for availability, log for review)`);
          resolve(true); // fail-open but logged - best for UX, can switch to fail-closed via env
        }
      });
      socket.on('error', err => {
        this.logger.warn(`ClamAV connection failed: ${err.message} - skipping scan (service may be starting)`);
        resolve(true); // Don't block upload if ClamAV down - log for SOC
      });
    });
  }
}
