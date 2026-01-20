import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { SupabaseService } from 'src/supabase/supabase.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async createWorkflow(userId: string, createWorkflowDto: CreateWorkflowDto) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('workflows')
      .insert({
        user_id: userId,
        name: createWorkflowDto.name || 'Untitled Workflow',
        description: createWorkflowDto.description,
        workflow_data: createWorkflowDto.workflowData,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating workflow:', error);
      throw new BadRequestException('Failed to create workflow');
    }

    return data;
  }

  async getWorkflows(userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching workflows:', error);
      throw new BadRequestException('Failed to fetch workflows');
    }

    return data;
  }

  async getWorkflowById(userId: string, workflowId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Workflow not found');
    }

    return data;
  }

  async updateWorkflow(
    userId: string,
    workflowId: string,
    updateWorkflowDto: UpdateWorkflowDto,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('workflows')
      .update({
        name: updateWorkflowDto.name,
        description: updateWorkflowDto.description,
        workflow_data: updateWorkflowDto.workflowData,
      })
      .eq('id', workflowId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Workflow not found or update failed');
    }

    return data;
  }

  async deleteWorkflow(userId: string, workflowId: string) {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', workflowId)
      .eq('user_id', userId);

    if (error) {
      throw new BadRequestException('Failed to delete workflow');
    }

    return { message: 'Workflow deleted successfully' };
  }

  /**
   * Send workflow created event via SSE
   */
  sendWorkflowCreatedEvent(
    res: Response,
    workflow: any,
    prompt?: string,
  ): void {
    try {
      // Create SSE formatted message
      const eventData = {
        type: 'workflow-created',
        workflowId: workflow.id,
        workflowName: workflow.name,
        prompt: prompt || '',
      };

      // Send as SSE data event
      const sseMessage = `data: ${JSON.stringify(eventData)}\n\n`;
      res.write(sseMessage);

      console.log(
        '📤 Sent workflow-created SSE event to frontend:',
        workflow.id,
      );
    } catch (error) {
      console.error('❌ Error sending workflow-created event:', error.message);
    }
  }

}
