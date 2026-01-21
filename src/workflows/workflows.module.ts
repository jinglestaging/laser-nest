import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { OpenAiModule } from 'src/openai/openai.module';

@Module({
  imports: [SupabaseModule, OpenAiModule],
  providers: [WorkflowsService],
  controllers: [WorkflowsController],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
