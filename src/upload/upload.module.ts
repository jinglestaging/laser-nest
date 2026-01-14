import { Module } from '@nestjs/common';
import { CloudinaryProvider } from './cloudinary.config';
import { UploadService } from './upload.service';
import { ConfigModule } from '@nestjs/config';
import { UploadController } from './upload.controller';
import { BackblazeB2Provider } from './backblaze-b2.config';
import { CommonModule } from 'src/common/common.module';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
  imports: [ConfigModule, CommonModule, SupabaseModule],
  controllers: [UploadController],
  providers: [CloudinaryProvider, BackblazeB2Provider, UploadService],
  exports: [UploadService],
})
export class UploadModule {}
