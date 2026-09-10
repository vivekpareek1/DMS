
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload?.sub || !payload?.email) {
      throw new UnauthorizedException('Malformed token payload');
    }

    request.user = { id: payload.sub, email: payload.email };
    return true;
  }

  private extractToken(request: any): string | undefined {
    const header = request.headers?.['authorization'];
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
