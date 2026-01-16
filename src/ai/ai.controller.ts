import {
  Controller,
  Post,
  Body,
  Res,
  UseGuards,
  Get,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { StreamChatDto } from './dto/stream-chat.dto';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { SupabaseAuthGuard } from 'src/common/guards/supabase-auth.guard';
import { GetUser } from 'src/common/decorators/user.decorator';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('stream')
  async streamChat(
    @GetUser() user: any,
    @Body() streamChatDto: StreamChatDto,
    @Res() res: Response,
  ) {
    return this.aiService.streamChat(streamChatDto.messages, res, user.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('workflows')
  async createWorkflow(
    @GetUser() user: any,
    @Body() createWorkflowDto: CreateWorkflowDto,
  ) {
    return this.aiService.createWorkflow(user.id, createWorkflowDto);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('workflows')
  async getWorkflows(@GetUser() user: any) {
    return this.aiService.getWorkflows(user.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('workflows/:id')
  async getWorkflowById(@GetUser() user: any, @Param('id') workflowId: string) {
    return this.aiService.getWorkflowById(user.id, workflowId);
  }

  @UseGuards(SupabaseAuthGuard)
  @Put('workflows/:id')
  async updateWorkflow(
    @GetUser() user: any,
    @Param('id') workflowId: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
  ) {
    return this.aiService.updateWorkflow(
      user.id,
      workflowId,
      updateWorkflowDto,
    );
  }

  @UseGuards(SupabaseAuthGuard)
  @Delete('workflows/:id')
  async deleteWorkflow(@GetUser() user: any, @Param('id') workflowId: string) {
    return this.aiService.deleteWorkflow(user.id, workflowId);
  }
}
