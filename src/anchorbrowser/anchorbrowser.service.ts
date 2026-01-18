import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import Anchorbrowser from 'anchorbrowser';

@Injectable()
export class AnchorbrowserService {
  private readonly anchorClient: Anchorbrowser;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.anchorClient = new Anchorbrowser({
      apiKey: this.configService.get<string>('ANCHOR_API_KEY'),
    });
  }

  getAnchorClient(): Anchorbrowser {
    return this.anchorClient;
  }
}
