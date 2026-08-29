
import { Injectable, CanActivate } from '@nestjs/common';
@Injectable()
export class SecureHeadersGuard implements CanActivate {
  canActivate(context: any): boolean {
    const res = context.switchToHttp().getResponse();
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('Referrer-Policy', 'no-referrer');
    return true;
  }
}
