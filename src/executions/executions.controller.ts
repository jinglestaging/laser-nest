import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { ExecutionsService } from './executions.service';
import { SupabaseAuthGuard } from 'src/common/guards/supabase-auth.guard';
import { GetUser } from 'src/common/decorators/user.decorator';

@UseGuards(SupabaseAuthGuard)
@Controller('executions')
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get()
  async listExecutions(@GetUser() user: SupabaseUser) {
    return this.executionsService.listExecutions(user.id);
  }

  @Get('workflow/:workflowId')
  async listExecutionsByWorkflow(
    @GetUser() user: SupabaseUser,
    @Param('workflowId') workflowId: string,
  ) {
    return this.executionsService.listExecutionsByWorkflow(user.id, workflowId);
  }

  @Get(':id')
  async getExecutionById(
    @GetUser() user: SupabaseUser,
    @Param('id') executionId: string,
  ) {
    return this.executionsService.getExecutionById(user.id, executionId);
  }
}
