import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import * as fs from 'fs';
import * as path from 'path';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentPart[];
}

interface ContentPart {
  type: string;
  text?: string;
  image_url?: { url: string };
}

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly logger = new Logger(ChatService.name);
  private systemPrompt: string = '';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.systemPrompt = this.loadSystemPrompts();
  }

  async streamChat(messages: ChatMessage[], res: Response): Promise<void> {
    const model = this.getModel();

    const transformedMessages = this.transformMessages(messages);
    const messagesWithSystem = this.addSystemPrompt(transformedMessages);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const result = streamText({
      model: openai(model),
      messages: messagesWithSystem as any,
    });

    const response = result.toUIMessageStreamResponse();

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      const reader = response.body.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch (error) {
        this.logger.error('Stream reading error', error);
      } finally {
        reader.releaseLock();
      }
    }

    res.end();
  }

  private loadSystemPrompts(): string {
    try {
      const promptsDir = path.join(process.cwd(), 'src/chat/prompts');
      const deepWikiPath = path.join(promptsDir, 'DeepWiki Prompt.txt');
      const mainPromptPath = path.join(promptsDir, 'Prompt.txt');

      let systemPrompt = '';

      if (fs.existsSync(deepWikiPath)) {
        const deepWikiContent = fs.readFileSync(deepWikiPath, 'utf-8').trim();
        if (deepWikiContent) {
          systemPrompt += deepWikiContent + '\n\n';
        }
      }

      if (fs.existsSync(mainPromptPath)) {
        const mainPromptContent = fs
          .readFileSync(mainPromptPath, 'utf-8')
          .trim();
        if (mainPromptContent) {
          systemPrompt += mainPromptContent;
        }
      }

      if (systemPrompt) {
        this.logger.log(`System prompts loaded (${systemPrompt.length} chars)`);
      } else {
        this.logger.warn('No system prompts found');
      }

      return systemPrompt.trim();
    } catch (error) {
      this.logger.error('Failed to load system prompts', error);
      return '';
    }
  }

  private addSystemPrompt(messages: ChatMessage[]): ChatMessage[] {
    const hasSystemMessage = messages.some((msg) => msg.role === 'system');

    if (this.systemPrompt && !hasSystemMessage) {
      return [
        {
          role: 'system',
          content: this.systemPrompt,
        },
        ...messages,
      ];
    }

    if (this.systemPrompt && hasSystemMessage) {
      return messages.map((msg) => {
        if (msg.role === 'system' && typeof msg.content === 'string') {
          return {
            ...msg,
            content: `${this.systemPrompt}\n\n${msg.content}`,
          };
        }
        return msg;
      });
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

  private transformMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((message) => {
      if (typeof message.content === 'string') {
        return message;
      }

      if (Array.isArray(message.content)) {
        const transformedContent = message.content.map((part: ContentPart) => {
          if (part.type === 'image_url' && part.image_url?.url) {
            return {
              type: 'image',
              image: part.image_url.url,
            };
          }
          return part;
        });

        return {
          ...message,
          content: transformedContent,
        };
      }

      return message;
    });
  }
}
