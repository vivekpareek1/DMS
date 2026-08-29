
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // P0 FIX: Secure headers
  app.use(helmet.default({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
    crossOriginEmbedderPolicy: false,
  }));

  // P0 FIX: CORS whitelist, not origin:true
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'https://dms.yourdomain.com'
  ];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET','POST','PUT','DELETE','PATCH'],
    allowedHeaders: ['Content-Type','Authorization'],
  });

  // P0 FIX: Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // strip unknown props
    forbidNonWhitelisted: true, // throw if unknown props
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  app.setGlobalPrefix('api');

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Backend running on ${await app.getUrl()} - CORS allowed: ${allowedOrigins.join(',')}`);
}
bootstrap().catch(err => {
  console.error('Bootstrap failed', err);
  process.exit(1);
});
