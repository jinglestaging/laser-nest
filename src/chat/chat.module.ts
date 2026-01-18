import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [ConfigModule, SupabaseModule, WorkflowsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
