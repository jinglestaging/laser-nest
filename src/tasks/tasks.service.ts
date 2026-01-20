import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AnchorbrowserService } from '../anchorbrowser/anchorbrowser.service';
import { Observable, Subject } from 'rxjs';

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

  createTaskSSE(sessionId: string, prompt: string): Observable<any> {
    const subject = new Subject();
    const client = this.anchorbrowserService.getAnchorClient();

    client.agent
      .task(prompt, {
        sessionId,
        taskOptions: {
          provider: 'groq',
          model: 'openai/gpt-oss-120b',
          onAgentStep: (executionStep) => {
            subject.next({ data: { type: 'step', step: executionStep } });
          },
        },
      })
      .then((result) => {
        subject.next({ data: { type: 'complete', result } });
        setTimeout(() => subject.complete(), 100);
      })
      .catch((error) => {
        subject.next({ data: { type: 'error', error: error.message } });
        setTimeout(() => subject.complete(), 100);
      });

    return subject.asObservable();
  }
}
