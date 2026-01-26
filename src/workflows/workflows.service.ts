import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from 'src/supabase/supabase.service';
import { OpenAiService } from 'src/openai/openai.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly openAiService: OpenAiService,
  ) {}

  private async generateWorkflowName(workflowData: string): Promise<string> {
    try {
      const prompt = `Analyze this workflow description and create a short, practical name (2-4 words) that describes what the AI workflow does: "${workflowData}"

Examples:
- "Read resume and fill donation form" → "Resume donation form"
- "Search products and add to cart" → "Product cart automation"
- "Extract data from website" → "Website data extraction"

Return only the name, no quotes or extra text.`;

      const completion = await this.openAiService.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 30,
        temperature: 0.3,
      });

      const name = completion.choices[0]?.message?.content?.trim();
      if (name && name.length <= 50) return name;
    } catch (error) {
      console.error('OpenAI name generation failed:', error);
    }

    return 'AI Workflow';
  }

  async createWorkflow(userId: string, createWorkflowDto: CreateWorkflowDto) {
    const supabase = this.supabaseService.getClient();

    const workflowName = await this.generateWorkflowName(
      createWorkflowDto.workflowData,
    );

    const { data, error } = await supabase
      .from('workflows')
      .insert({
        user_id: userId,
        name: workflowName,
        description: createWorkflowDto.description,
        url: createWorkflowDto.url,
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
        url: updateWorkflowDto.url,
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
}
