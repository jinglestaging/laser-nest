import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AnchorbrowserService } from '../anchorbrowser/anchorbrowser.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly anchorbrowserService: AnchorbrowserService,
  ) {}

  async createSession() {
    const client = this.anchorbrowserService.getAnchorClient();
    const session = await client.sessions.create();

    if (!session.data) {
      throw new Error('Failed to create session');
    }

    const liveViewUrl = session.data.live_view_url;
    const sessionId = session.data.id;

    if (!sessionId || !liveViewUrl) {
      throw new Error('Invalid session data: missing sessionId or liveViewUrl');
    }

    return {
      sessionId,
      liveViewUrl,
    };
  }

  async createTask(sessionId: string, prompt: string): Promise<any> {
    const client = this.anchorbrowserService.getAnchorClient();
    const executionStepLogs: any[] = [];

    const result = await client.agent.task(prompt, {
      sessionId,
      taskOptions: {
        onAgentStep: (executionStep) => {
          console.log('Agent step:', executionStep); // Real-time log!
          executionStepLogs.push(executionStep);
        },
      },
    });

    return { result, executionStepLogs };
  }
}
