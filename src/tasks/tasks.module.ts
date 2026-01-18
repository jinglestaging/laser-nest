import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AnchorbrowserModule } from '../anchorbrowser/anchorbrowser.module';

@Module({
  imports: [ConfigModule, SupabaseModule, AnchorbrowserModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
