import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseService } from '../supabase/supabase.service';
import { WorkflowsService } from '../workflows/workflows.service';

@Injectable()
export class ChatService {
  private systemPrompt: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly workflowsService: WorkflowsService,
  ) {
    this.systemPrompt = this.loadSystemPrompts();
  }

  async streamChat(
    messages: any[],
    res: Response,
    userId?: string,
  ): Promise<void> {
    const model = this.getModel();

    // Debug logging to see what backend receives
    console.log(
      '🔍 Backend received messages:',
      JSON.stringify(messages, null, 2),
    );
    console.log('📦 Using model:', model);

    // Check if this is the first message from the user
    const isFirstMessage = messages.length === 1 && messages[0].role === 'user';
    console.log('🎯 Is first message:', isFirstMessage);

    // Variable to store workflow info for sending event after streaming
    let firstMessageWorkflow: any = null;

    // If it's the first message, create a workflow from the user's prompt
    if (isFirstMessage && userId) {
      const userMessage = messages[0].content;
      const userMessageText = typeof userMessage === 'string' ? userMessage : JSON.stringify(userMessage);

      console.log('📝 Creating workflow from first user message...');

      const workflowDto = {
        name: userMessageText.substring(0, 100) || 'User Prompt Workflow',
        description: 'Workflow created from user\'s first message',
        workflowData: userMessageText,
      };

      try {
        const savedWorkflow = await this.workflowsService.createWorkflow(
          userId,
          workflowDto,
        );
        console.log('💾 Workflow created successfully:', savedWorkflow.id);
        console.log('🎉 Workflow name:', savedWorkflow.name);

        // Store workflow info to send event after streaming completes
        firstMessageWorkflow = {
          workflow: savedWorkflow,
          prompt: userMessageText,
        };
      } catch (error) {
        console.error('❌ Failed to create workflow from first message:', error);
      }
    }

    // Transform messages from OpenAI format to AI SDK format
    const transformedMessages = this.transformMessages(messages);
    console.log(
      '🔄 Transformed messages:',
      JSON.stringify(transformedMessages, null, 2),
    );

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

    // After streaming is complete, send workflow creation event if it was the first message
    if (firstMessageWorkflow) {
      console.log('📤 Sending workflow creation event after streaming...');
      this.workflowsService.sendWorkflowCreatedEvent(
        res,
        firstMessageWorkflow.workflow,
        firstMessageWorkflow.prompt,
      );
    }

    res.end();
  }

  /**
   * Load system prompts from text files
   */
  private loadSystemPrompts(): string {
    try {
      const promptsDir = path.join(process.cwd(), 'src/chat/prompts');
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
          console.log(
            '✅ DeepWiki Prompt loaded:',
            deepWikiContent.length,
            'characters',
          );
        }
      } else {
        console.log('⚠️  DeepWiki Prompt.txt not found');
      }

      // Load Main Prompt if it exists
      if (fs.existsSync(mainPromptPath)) {
        const mainPromptContent = fs
          .readFileSync(mainPromptPath, 'utf-8')
          .trim();
        if (mainPromptContent) {
          systemPrompt += mainPromptContent;
          console.log(
            '✅ Main Prompt loaded:',
            mainPromptContent.length,
            'characters',
          );
        }
      } else {
        console.log('⚠️  Prompt.txt not found');
      }

      if (systemPrompt) {
        console.log('✅ System prompts loaded successfully');
        console.log(
          '📝 Total system prompt length:',
          systemPrompt.length,
          'characters',
        );
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
    const hasSystemMessage = messages.some((msg) => msg.role === 'system');

    // If there's a system prompt and no system message exists, prepend it
    if (this.systemPrompt && !hasSystemMessage) {
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
      return messages.map((msg) => {
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
}
