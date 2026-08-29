
export interface RetentionConfig {
  retentionDays: number; // default 180
  archiveMode: boolean; // if true, export to GCS before purge
  legalHold: boolean; // if true, NEVER purge
  archiveBucket: string;
  batchSize: number;
  perCategoryRetention?: Record<string, number>; // e.g. { SECURITY: 365, ACCESS: 180 }
}

export function getRetentionConfig(): RetentionConfig {
  const defaultDays = parseInt(process.env.LOG_RETENTION_DAYS || '180', 10);
  if (isNaN(defaultDays) || defaultDays < 1) throw new Error('LOG_RETENTION_DAYS must be >=1');
  
  return {
    retentionDays: defaultDays,
    archiveMode: process.env.LOG_ARCHIVE_MODE === 'true',
    legalHold: process.env.LOG_LEGAL_HOLD === 'true',
    archiveBucket: process.env.LOG_ARCHIVE_BUCKET || 'vault-dms-log-archive',
    batchSize: parseInt(process.env.LOG_PURGE_BATCH_SIZE || '1000', 10),
    perCategoryRetention: process.env.LOG_CATEGORY_RETENTION ? JSON.parse(process.env.LOG_CATEGORY_RETENTION) : undefined,
  };
}
