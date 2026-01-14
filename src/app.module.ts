import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailModule } from './email/email.module';
import { UploadModule } from './upload/upload.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from 'nestjs-pino';
import { StripeModule } from './stripe/stripe.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AutomationModule } from './automation/automation.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        name: 'foundry-backend',
        customSuccessMessage: () => 'request completed',
        serializers: {
          req: (req: any) => ({
            id: req.id ?? Math.floor(Math.random() * 100000),
            method: req.method,
            url: req.url,
            query: req.query,
            params: req.params,
            headers: req.headers,
          }),
          res: (res: any) => ({
            statusCode: res.statusCode,
            headers: res.getHeaders?.() ?? res.headers ?? {},
          }),
        },
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CommonModule,
    UploadModule,
    EmailModule,
    UsersModule,
    HealthModule,
    StripeModule,
    SupabaseModule,
    AutomationModule,
    AiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
