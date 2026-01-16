import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';

type ChatCompletionCreateArgs = Parameters<
  OpenAI['chat']['completions']['create']
>[0];

@Injectable()
export class OpenAiService {
  private client?: OpenAI;

  constructor(private readonly configService: ConfigService) {}

  getClient(): OpenAI {
    return this.ensureClient();
  }

  getDefaultModel(): string {
    return (
      this.configService.get<string>('OPENAI_MODEL') ||
      process.env.OPENAI_MODEL ||
      'gpt-4o'
    );
  }

  async createChatCompletion(
    args: Omit<ChatCompletionCreateArgs, 'model'> & { model?: string },
  ): Promise<OpenAI.ChatCompletion> {
    const client = this.ensureClient();
    const model = args.model ?? this.getDefaultModel();
    console.log('OpenAI API call - model:', model);

    try {
      const completion = await client.chat.completions.create({
        ...args,
        model,
        stream: false,
      });
      console.log('OpenAI API call - success');
      return completion;
    } catch (error) {
      console.log('OpenAI API call - error:', error);
      throw error;
    }
  }

  private ensureClient(): OpenAI {
    if (this.client) {
      return this.client;
    }

    const apiKey =
      this.configService.get<string>('OPENAI_API_KEY') ||
      process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('Missing OPENAI_API_KEY env var');
    }

    const baseUrl =
      this.configService.get<string>('OPENAI_BASE_URL') ||
      process.env.OPENAI_BASE_URL;
    const trimmedBaseUrl = baseUrl?.replace(/\/$/, '');

    console.log(
      'OpenAI client init - API key present:',
      !!apiKey,
      'length:',
      apiKey.length,
    );
    console.log(
      'OpenAI client init - API key starts with:',
      apiKey.substring(0, 10) + '...',
    );
    console.log(
      'OpenAI client init - base URL:',
      trimmedBaseUrl || 'default (will use OpenAI default)',
    );

    const clientConfig = {
      apiKey,
      ...(trimmedBaseUrl ? { baseURL: trimmedBaseUrl } : {}),
    };

    console.log('OpenAI client config:', {
      hasApiKey: !!clientConfig.apiKey,
      baseURL: clientConfig.baseURL || 'default',
    });

    this.client = new OpenAI(clientConfig);

    return this.client;
  }
}
