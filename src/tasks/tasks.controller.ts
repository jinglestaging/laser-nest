import { Controller, Post, Sse, MessageEvent, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TasksService } from './tasks.service';
import { CreateSessionResponseDto } from './dto/create-session-response.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('session')
  async createSession(): Promise<CreateSessionResponseDto> {
    return this.tasksService.createSession();
  }

  @Sse('task-sse')
  createTaskSSE(
    @Query('sessionId') sessionId: string,
    @Query('prompt') prompt: string,
    @Query('url') url: string,
  ): Observable<MessageEvent> {
    return this.tasksService.createTaskSSE(sessionId, prompt, url);
  }
}
