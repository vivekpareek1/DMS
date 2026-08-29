
import * as crypto from 'crypto';
const REDACT_PATTERNS = [
  { regex: /(Bearer\s+)[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+/gi, replace: '$1[REDACTED_JWT]' },
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replace: '[REDACTED_EMAIL]' },
  { regex: /password['"]?\s*[:=]\s*['"][^'"]+['"]/gi, replace: 'password=[REDACTED]' },
];
export const secureLogger = {
  info: (msg:string, meta?:any)=> console.log(JSON.stringify({level:'info',msg,meta,ts:new Date().toISOString()})),
  error: (msg:string, meta?:any)=> console.error(JSON.stringify({level:'error',msg,meta,ts:new Date().toISOString()})),
  warn: (msg:string, meta?:any)=> console.warn(JSON.stringify({level:'warn',msg,meta,ts:new Date().toISOString()})),
};
export function auditLogHashChain(prevHash:string, payload:object):string {
  return crypto.createHash('sha256').update(prevHash + JSON.stringify(payload)).digest('hex');
}
