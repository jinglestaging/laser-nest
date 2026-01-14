import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ConfigService } from '@nestjs/config';
import { MulterExceptionFilter } from './upload/multer-exception.filter';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
  });

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV') || process.env.NODE_ENV;
  const isDevelopment = nodeEnv === 'development';

  if (!isDevelopment) {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 500, // 500 requests per 15 minutes (~2000 per hour) per IP
      standardHeaders: true, // Sends RateLimit-* headers for better client awareness
      legacyHeaders: false,
      message: {
        message: 'Too many requests from this IP',
        error: 'Rate limit exceeded',
        statusCode: 429,
      },
    });

    app.use(limiter);
  }

  app.use(helmet());

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new MulterExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get<string>('PORT') || '3004';

  await app.listen(parseInt(port, 10));
  console.log(`Application is running on port: ${port}`);
  console.log(`Environment: ${nodeEnv}`);
}

void bootstrap();
