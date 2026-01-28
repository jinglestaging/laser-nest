import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anchorbrowser from 'anchorbrowser';

@Injectable()
export class AnchorbrowserService implements OnModuleInit {
  private readonly logger = new Logger(AnchorbrowserService.name);
  private readonly anchorClient: Anchorbrowser;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANCHOR_API_KEY');
    if (!apiKey) {
      throw new Error('ANCHOR_API_KEY is required');
    }

    this.anchorClient = new Anchorbrowser({ apiKey });
  }

  onModuleInit(): void {
    this.logger.log('Anchorbrowser service initialized');
  }

  getAnchorClient(): Anchorbrowser {
    return this.anchorClient;
  }
}
