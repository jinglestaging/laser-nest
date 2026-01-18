import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { SupabaseAuthGuard } from 'src/common/guards/supabase-auth.guard';
import { GetUser } from 'src/common/decorators/user.decorator';

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post()
  async createWorkflow(
    @GetUser() user: any,
    @Body() createWorkflowDto: CreateWorkflowDto,
  ) {
    return this.workflowsService.createWorkflow(user.id, createWorkflowDto);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get()
  async getWorkflows(@GetUser() user: any) {
    return this.workflowsService.getWorkflows(user.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get(':id')
  async getWorkflowById(@GetUser() user: any, @Param('id') workflowId: string) {
    return this.workflowsService.getWorkflowById(user.id, workflowId);
  }

  @UseGuards(SupabaseAuthGuard)
  @Put(':id')
  async updateWorkflow(
    @GetUser() user: any,
    @Param('id') workflowId: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
  ) {
    return this.workflowsService.updateWorkflow(
      user.id,
      workflowId,
      updateWorkflowDto,
    );
  }

  @UseGuards(SupabaseAuthGuard)
  @Delete(':id')
  async deleteWorkflow(@GetUser() user: any, @Param('id') workflowId: string) {
    return this.workflowsService.deleteWorkflow(user.id, workflowId);
  }
}
