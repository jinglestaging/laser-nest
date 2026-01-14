import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseService } from 'src/supabase/supabase.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Injectable()
export class AiService {
  private systemPrompt: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.systemPrompt = this.loadSystemPrompts();
  }

  async streamChat(messages: any[], res: Response, userId?: string): Promise<void> {
    const model = this.getModel();

    // Debug logging to see what backend receives
    console.log('🔍 Backend received messages:', JSON.stringify(messages, null, 2));
    console.log('📦 Using model:', model);

    // Transform messages from OpenAI format to AI SDK format
    const transformedMessages = this.transformMessages(messages);
    console.log('🔄 Transformed messages:', JSON.stringify(transformedMessages, null, 2));

    // Prepend system prompt if it exists and there's no system message
    const messagesWithSystem = this.addSystemPrompt(transformedMessages);

    const result = streamText({
      model: openai(model),
      messages: messagesWithSystem,
    });

    // Get the Web API Response
    const response = result.toUIMessageStreamResponse();

    // Copy headers from Web API Response to Express Response
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Accumulate the complete response to check for workflow JSON
    let completeResponse = '';

    // Stream the body
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Decode and accumulate the response
          const chunk = decoder.decode(value, { stream: true });
          completeResponse += chunk;
          
          // Write to response stream
          res.write(value);
        }
      } finally {
        reader.releaseLock();
      }
    }

    // After streaming is complete, check for workflow JSON and save it
    // We need to do this BEFORE res.end() so we can send the workflow-created event
    if (userId) {
      console.log('📝 Complete response length:', completeResponse.length);
      console.log('📝 First 500 chars:', completeResponse.substring(0, 500));
      await this.detectAndSaveWorkflow(completeResponse, userId, res);
    }

    res.end();
  }

  /**
   * Load system prompts from text files
   */
  private loadSystemPrompts(): string {
    try {
      const promptsDir = path.join(__dirname, 'prompts');
      const deepWikiPath = path.join(promptsDir, 'DeepWiki Prompt.txt');
      const mainPromptPath = path.join(promptsDir, 'Prompt.txt');

      console.log('🔍 Looking for prompts in:', promptsDir);
      console.log('🔍 DeepWiki path:', deepWikiPath);
      console.log('🔍 Main prompt path:', mainPromptPath);
      console.log('🔍 DeepWiki exists:', fs.existsSync(deepWikiPath));
      console.log('🔍 Main prompt exists:', fs.existsSync(mainPromptPath));

      let systemPrompt = '';

      // Load DeepWiki Prompt if it exists
      if (fs.existsSync(deepWikiPath)) {
        const deepWikiContent = fs.readFileSync(deepWikiPath, 'utf-8').trim();
        if (deepWikiContent) {
          systemPrompt += deepWikiContent + '\n\n';
          console.log('✅ DeepWiki Prompt loaded:', deepWikiContent.length, 'characters');
        }
      } else {
        console.log('⚠️  DeepWiki Prompt.txt not found');
      }

      // Load Main Prompt if it exists
      if (fs.existsSync(mainPromptPath)) {
        const mainPromptContent = fs.readFileSync(mainPromptPath, 'utf-8').trim();
        if (mainPromptContent) {
          systemPrompt += mainPromptContent;
          console.log('✅ Main Prompt loaded:', mainPromptContent.length, 'characters');
        }
      } else {
        console.log('⚠️  Prompt.txt not found');
      }

      if (systemPrompt) {
        console.log('✅ System prompts loaded successfully');
        console.log('📝 Total system prompt length:', systemPrompt.length, 'characters');
      } else {
        console.log('⚠️  No system prompts found or prompts are empty');
      }

      return systemPrompt.trim();
    } catch (error) {
      console.error('❌ Error loading system prompts:', error.message);
      console.error('❌ Stack trace:', error.stack);
      return '';
    }
  }

  /**
   * Add system prompt to messages if it doesn't already exist
   */
  private addSystemPrompt(messages: any[]): any[] {
    // Check if there's already a system message
    const hasSystemMessage = messages.some(msg => msg.role === 'system');

    // If there's a system prompt and no system message exists, prepend it
    if (this.systemPrompt && !hasSystemMessage) {
      console.log('✅ Adding system prompt as new system message');
      return [
        {
          role: 'system',
          content: this.systemPrompt,
        },
        ...messages,
      ];
    }

    // If there's a system prompt and a system message exists, append to existing
    if (this.systemPrompt && hasSystemMessage) {
      console.log('✅ Appending system prompt to existing system message');
      return messages.map(msg => {
        if (msg.role === 'system') {
          return {
            ...msg,
            content: `${this.systemPrompt}\n\n${msg.content}`,
          };
        }
        return msg;
      });
    }

    // Otherwise, return messages as-is
    if (!this.systemPrompt) {
      console.log('⚠️  No system prompt available to add');
    }
    return messages;
  }

  private getModel(): string {
    return (
      this.configService.get<string>('OPENAI_MODEL') ||
      process.env.OPENAI_MODEL ||
      'gpt-4o' // Vision-capable model (changed from gpt-4o-mini)
    );
  }

  /**
   * Transform messages from OpenAI format to AI SDK format
   * OpenAI: { type: "image_url", image_url: { url: "..." } }
   * AI SDK: { type: "image", image: "..." }
   */
  private transformMessages(messages: any[]): any[] {
    return messages.map((message) => {
      // If content is a string, return as-is
      if (typeof message.content === 'string') {
        return message;
      }

      // If content is an array (vision messages), transform each part
      if (Array.isArray(message.content)) {
        const transformedContent = message.content.map((part: any) => {
          // Transform image_url to image format
          if (part.type === 'image_url' && part.image_url?.url) {
            return {
              type: 'image',
              image: part.image_url.url,
            };
          }
          // Keep text parts as-is
          return part;
        });

        return {
          ...message,
          content: transformedContent,
        };
      }

      // Return message as-is if it doesn't match any pattern
      return message;
    });
  }

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
   * Send SSE event to frontend when workflow is created
   */
  private sendWorkflowCreatedEvent(res: Response, workflow: any): void {
    try {
      // Create SSE formatted message
      const eventData = {
        type: 'workflow-created',
        workflowId: workflow.id,
        workflowName: workflow.name,
        nodeCount: workflow.workflow_data?.nodes?.length || 0,
        edgeCount: workflow.workflow_data?.edges?.length || 0,
      };
      
      // Send as SSE data event
      const sseMessage = `data: ${JSON.stringify(eventData)}\n\n`;
      res.write(sseMessage);
      
      console.log('📤 Sent workflow-created SSE event to frontend:', workflow.id);
    } catch (error) {
      console.error('❌ Error sending workflow-created event:', error.message);
    }
  }

  /**
   * Detect workflow JSON in AI response and automatically save it
   * Sends SSE event to frontend when workflow is created
   */
  private async detectAndSaveWorkflow(responseText: string, userId: string, res: Response): Promise<void> {
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
      
      // Now try to parse the extracted text as JSON (it should be a complete workflow JSON)
      try {
        const parsed = JSON.parse(extractedText);
        
        // Check if it looks like a workflow (has nodes and edges)
        if (parsed.nodes && parsed.edges && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          console.log('✅ Workflow JSON detected!');
          console.log('📦 Nodes:', parsed.nodes.length);
          console.log('🔗 Edges:', parsed.edges.length);
          
          // Extract workflow name from nodes if possible
          const workflowSteps = parsed.nodes.map((n: any) => n.data?.label).filter(Boolean);
          const workflowName = workflowSteps.length > 0 
            ? `${workflowSteps[0]}` 
            : 'AI Generated Workflow';
          
          // Create workflow DTO
          const workflowDto = {
            name: workflowName,
            description: `Auto-generated workflow with ${parsed.nodes.length} steps`,
            workflowData: {
              nodes: parsed.nodes,
              edges: parsed.edges,
            },
          };
          
          // Save to database
          const savedWorkflow = await this.createWorkflow(userId, workflowDto);
          console.log('💾 Workflow saved successfully:', savedWorkflow.id);
          console.log('🎉 Workflow name:', savedWorkflow.name);
          
          // Send SSE event to frontend
          this.sendWorkflowCreatedEvent(res, savedWorkflow);
          
          return; // Success, exit
        }
      } catch (parseError) {
        // If direct parse fails, try to find JSON in text (markdown code blocks, etc.)
        console.log('⚠️  Direct JSON parse failed, searching for JSON in text...');
      }
      
      // Fallback: Try to extract JSON from markdown code blocks or raw JSON
      const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
      const matches = [...extractedText.matchAll(jsonBlockRegex)];
      
      // Also search for raw JSON with proper nesting
      const nestedJsonRegex = /(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})/g;
      const nestedMatches = [...extractedText.matchAll(nestedJsonRegex)];
      
      const allMatches = [
        ...matches.map(m => m[1]), 
        ...nestedMatches.map(m => m[1])
      ];
      
      console.log('🔍 Found', allMatches.length, 'potential JSON objects');
      
      for (const jsonString of allMatches) {
        try {
          const parsed = JSON.parse(jsonString);
          
          // Check if it looks like a workflow (has nodes and edges)
          if (parsed.nodes && parsed.edges && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
            console.log('✅ Workflow JSON detected in code block!');
            console.log('📦 Nodes:', parsed.nodes.length);
            console.log('🔗 Edges:', parsed.edges.length);
            
            // Extract workflow name from nodes if possible
            const workflowSteps = parsed.nodes.map((n: any) => n.data?.label).filter(Boolean);
            const workflowName = workflowSteps.length > 0 
              ? `${workflowSteps[0]}` 
              : 'AI Generated Workflow';
            
            // Create workflow DTO
            const workflowDto = {
              name: workflowName,
              description: `Auto-generated workflow with ${parsed.nodes.length} steps`,
              workflowData: {
                nodes: parsed.nodes,
                edges: parsed.edges,
              },
            };
            
            // Save to database
            const savedWorkflow = await this.createWorkflow(userId, workflowDto);
            console.log('💾 Workflow saved successfully:', savedWorkflow.id);
            console.log('🎉 Workflow name:', savedWorkflow.name);
            
            // Send SSE event to frontend
            this.sendWorkflowCreatedEvent(res, savedWorkflow);
            
            // Only save the first valid workflow found
            break;
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
