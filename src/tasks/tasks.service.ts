import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AnchorbrowserService } from '../anchorbrowser/anchorbrowser.service';
import {
  ExecutionsService,
  ExecutionStatus,
} from '../executions/executions.service';
import { Observable, Subject } from 'rxjs';

const TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly anchorbrowserService: AnchorbrowserService,
    private readonly executionsService: ExecutionsService,
  ) {}

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
    userId: string,
    workflowId: string,
  ): Observable<{ data: Record<string, unknown> }> {
    const subject = new Subject<{ data: Record<string, unknown> }>();
    const client = this.anchorbrowserService.getAnchorClient();

    void (async () => {
      let executionId: string | null = null;
      const inputPayload = JSON.stringify({ sessionId, prompt, url });

      try {
        const execution = await this.executionsService.createExecution(
          userId,
          workflowId,
          inputPayload,
        );
        executionId = execution.id;
      } catch (error) {
        this.logger.error('Failed to create execution', error);
        subject.next({
          data: { type: 'error', error: 'Failed to create execution' },
        });
        setTimeout(() => subject.complete(), 100);
        return;
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), TASK_TIMEOUT_MS);
      });

      const taskPromise = client.agent.task(prompt, {
        sessionId,
        taskOptions: {
          provider: 'groq',
          model: 'openai/gpt-oss-120b',
          url,
          onAgentStep: (executionStep) => {
            subject.next({ data: { type: 'step', step: executionStep } });
          },
        },
      });

      try {
        const result = await Promise.race([taskPromise, timeoutPromise]);
        if (executionId) {
          void this.executionsService.completeExecution(
            userId,
            executionId,
            'success' as ExecutionStatus,
            JSON.stringify(result),
          );
        }
        subject.next({ data: { type: 'complete', result } });
      } catch (error) {
        const isTimeout =
          error instanceof Error && error.message === 'Task timeout';
        const status: ExecutionStatus = isTimeout ? 'timeout' : 'failure';
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        this.logger.error(`Task ${status}: ${errorMessage}`);

        if (executionId) {
          void this.executionsService.completeExecution(
            userId,
            executionId,
            status,
            errorMessage,
          );
        }
        subject.next({ data: { type: 'error', error: errorMessage } });
      } finally {
        setTimeout(() => subject.complete(), 100);
      }
    })();

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
