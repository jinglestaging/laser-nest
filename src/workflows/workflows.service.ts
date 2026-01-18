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
    isReady?: boolean,
    clarificationQuestions?: string[],
  ): void {
    try {
      // Create SSE formatted message
      const eventData = {
        type: 'workflow-created',
        workflowId: workflow.id,
        workflowName: workflow.name,
        prompt: prompt || '',
        is_ready: isReady ?? true,
        clarification_questions: clarificationQuestions || [],
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

  /**
   * Detect workflow JSON in AI response and automatically save it
   * Sends SSE event to frontend when workflow is created
   */
  async detectAndSaveWorkflow(
    responseText: string,
    userId: string,
    res: Response,
  ): Promise<void> {
    try {
      console.log('🔍 Checking for workflow JSON in response...');

      // The response is in SSE format: data: {"type":"text-delta","delta":"..."}
      // We need to extract all delta values and reconstruct the message
      let extractedText = '';

      // Split by lines and process SSE format
      const lines = responseText.split('\n');
      for (const line of lines) {
        // SSE lines start with "data: "
        if (line.startsWith('data: ')) {
          const jsonString = line.substring(6); // Remove "data: " prefix
          try {
            const obj = JSON.parse(jsonString);
            // Extract delta field which contains the actual text chunks
            if (obj.type === 'text-delta' && obj.delta) {
              extractedText += obj.delta;
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }

      console.log('📝 Extracted text length:', extractedText.length);
      console.log('📝 Extracted preview:', extractedText.substring(0, 500));

      // Variables to store the new response format properties
      let prompt: string | undefined;
      let isReady: boolean | undefined;
      let clarificationQuestions: string[] | undefined;

      // Now try to parse the extracted text as JSON
      try {
        const parsed = JSON.parse(extractedText);

        // Check if it contains the new response format (prompt, is_ready, clarification_questions)
        if (parsed.prompt !== undefined) {
          console.log('✅ New response format detected!');
          prompt = parsed.prompt;
          isReady = parsed.is_ready;
          clarificationQuestions = parsed.clarification_questions || [];

          console.log('📝 Prompt:', prompt);
          console.log('✔️  Is Ready:', isReady);
          console.log('❓ Clarification Questions:', clarificationQuestions);

          // If is_ready is true, save the prompt as a workflow
          if (isReady && prompt) {
            console.log('✅ Prompt is ready! Creating workflow...');

            const workflowDto = {
              name: prompt.substring(0, 100) || 'AI Generated Workflow',
              description: 'User prompt ready for processing',
              workflowData: prompt,
            };

            // Save to database
            const savedWorkflow = await this.createWorkflow(
              userId,
              workflowDto,
            );
            console.log('💾 Workflow saved successfully:', savedWorkflow.id);
            console.log('🎉 Workflow name:', savedWorkflow.name);

            // Send SSE event to frontend
            this.sendWorkflowCreatedEvent(
              res,
              savedWorkflow,
              prompt,
              isReady,
              clarificationQuestions,
            );

            return; // Success, exit
          }
        }
      } catch (parseError) {
        // If direct parse fails, try to find JSON in text (markdown code blocks, etc.)
        console.log(
          '⚠️  Direct JSON parse failed, searching for JSON in text...',
        );
      }

      // Fallback: Try to extract JSON from markdown code blocks or raw JSON
      const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
      const matches = [...extractedText.matchAll(jsonBlockRegex)];

      // Also search for raw JSON with proper nesting
      const nestedJsonRegex = /(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})/g;
      const nestedMatches = [...extractedText.matchAll(nestedJsonRegex)];

      const allMatches = [
        ...matches.map((m) => m[1]),
        ...nestedMatches.map((m) => m[1]),
      ];

      console.log('🔍 Found', allMatches.length, 'potential JSON objects');

      for (const jsonString of allMatches) {
        try {
          const parsed = JSON.parse(jsonString);

          // Check if it contains the new response format first
          if (parsed.prompt !== undefined) {
            console.log('✅ New response format detected in fallback!');
            prompt = parsed.prompt;
            isReady = parsed.is_ready;
            clarificationQuestions = parsed.clarification_questions || [];

            console.log('📝 Prompt:', prompt);
            console.log('✔️  Is Ready:', isReady);
            console.log('❓ Clarification Questions:', clarificationQuestions);

            // If is_ready is true, save the prompt as a workflow
            if (isReady && prompt) {
              console.log(
                '✅ Prompt is ready! Creating workflow from fallback...',
              );

              const workflowDto = {
                name: prompt.substring(0, 100) || 'AI Generated Workflow',
                description: 'User prompt ready for processing',
                workflowData: prompt,
              };

              // Save to database
              const savedWorkflow = await this.createWorkflow(
                userId,
                workflowDto,
              );
              console.log('💾 Workflow saved successfully:', savedWorkflow.id);
              console.log('🎉 Workflow name:', savedWorkflow.name);

              // Send SSE event to frontend
              this.sendWorkflowCreatedEvent(
                res,
                savedWorkflow,
                prompt,
                isReady,
                clarificationQuestions,
              );

              return; // Success, exit
            }
          }
        } catch (parseError) {
          // Not valid JSON or not a workflow, continue checking
          continue;
        }
      }
    } catch (error) {
      console.error('❌ Error detecting/saving workflow:', error.message);
      console.error('❌ Stack:', error.stack);
      // Don't throw - we don't want to break the streaming if workflow detection fails
    }
  }
}
