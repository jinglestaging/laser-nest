import {
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';

export type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failure'
  | 'timeout'
  | 'cancelled';

@Injectable()
export class ExecutionsService {
  private readonly logger = new Logger(ExecutionsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async listExecutions(userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Error fetching executions', error);
      throw new InternalServerErrorException('Failed to fetch executions');
    }

    return data;
  }

  async listExecutionsByWorkflow(userId: string, workflowId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('user_id', userId)
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Error fetching workflow executions', error);
      throw new InternalServerErrorException(
        'Failed to fetch workflow executions',
      );
    }

    return data;
  }

  async getExecutionById(userId: string, executionId: string) {
    const supabase = this.supabaseService.getClient();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', executionId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Execution not found');
    }

    return data;
  }

  async createExecution(
    userId: string,
    workflowId: string,
    inputPayload: string | null,
  ) {
    const supabase = this.supabaseService.getClient();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, error } = await supabase
      .from('workflow_executions')
      .insert({
        user_id: userId,
        workflow_id: workflowId,
        status: 'running' as ExecutionStatus,
        input_payload: inputPayload,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating execution', error);
      throw new InternalServerErrorException('Failed to create execution');
    }

    return data;
  }

  async completeExecution(
    userId: string,
    executionId: string,
    status: ExecutionStatus,
    outputPayload: string | null,
  ) {
    const supabase = this.supabaseService.getClient();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, error } = await supabase
      .from('workflow_executions')
      .update({
        status,
        output_payload: outputPayload,
        finished_at: new Date().toISOString(),
      })
      .eq('id', executionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error('Error completing execution', error);
      throw new InternalServerErrorException('Failed to update execution');
    }

    return data;
  }
}
