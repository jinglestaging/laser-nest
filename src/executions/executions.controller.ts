import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { SupabaseAuthGuard } from 'src/common/guards/supabase-auth.guard';
import { GetUser } from 'src/common/decorators/user.decorator';

@UseGuards(SupabaseAuthGuard)
@Controller('executions')
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get()
  async listExecutions(@GetUser() user: any) {
    return this.executionsService.listExecutions(user.id);
  }

  @Get('workflow/:workflowId')
  async listExecutionsByWorkflow(
    @GetUser() user: any,
    @Param('workflowId') workflowId: string,
  ) {
    return this.executionsService.listExecutionsByWorkflow(user.id, workflowId);
  }

  @Get(':id')
  async getExecutionById(
    @GetUser() user: any,
    @Param('id') executionId: string,
  ) {
    return this.executionsService.getExecutionById(user.id, executionId);
  }
}
