
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: { host: process.env.REDIS_HOST || 'redis', port: 6379 }
    }),
    BullModule.registerQueue(
      { name: 'thumbnail' },
      { name: 'ocr' },
      { name: 'retention' },
      { name: 'drive-sync' }
    )
  ],
  exports: [BullModule]
})
export class QueueModule {}
