import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnchorbrowserService } from './anchorbrowser.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [ConfigModule, SupabaseModule],
  providers: [AnchorbrowserService],
  exports: [AnchorbrowserService],
})
export class AnchorbrowserModule {}
