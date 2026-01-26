import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AnchorbrowserService } from '../anchorbrowser/anchorbrowser.service';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class TasksService {
  constructor(private readonly anchorbrowserService: AnchorbrowserService) {}

  async createSession() {
    const client = this.anchorbrowserService.getAnchorClient();

    try {
      const { data } = await client.sessions.create();

      if (!data?.id || !data?.live_view_url) {
        throw new HttpException(
          'Invalid session data: missing sessionId or liveViewUrl',
          HttpStatus.BAD_GATEWAY,
        );
      }

      return {
        sessionId: data.id,
        liveViewUrl: data.live_view_url,
      };
    } catch (error: unknown) {
      throw this.toHttpException(error);
    }
  }

  createTaskSSE(
    sessionId: string,
    prompt: string,
    url: string,
  ): Observable<any> {
    const subject = new Subject();
    const client = this.anchorbrowserService.getAnchorClient();

    client.agent
      .task(prompt, {
        sessionId,
        taskOptions: {
          provider: 'groq',
          model: 'openai/gpt-oss-120b',
          url,
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

  private toHttpException(error: unknown): HttpException {
    const anchorError = error as {
      status?: number | string;
      statusCode?: number | string;
      message?: string;
      error?: { message?: string };
    };

    const statusValue =
      anchorError.status ??
      anchorError.statusCode ??
      HttpStatus.INTERNAL_SERVER_ERROR;

    const status =
      typeof statusValue === 'number'
        ? statusValue
        : Number.isFinite(Number(statusValue))
          ? Number(statusValue)
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      anchorError.error?.message ??
      anchorError.message ??
      'Failed to create session';

    return new HttpException(message, status);
  }
}
