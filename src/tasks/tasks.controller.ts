import {
  Controller,
  Post,
  Sse,
  MessageEvent,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TasksService } from './tasks.service';
import { CreateSessionResponseDto } from './dto/create-session-response.dto';
import { SupabaseAuthGuard } from 'src/common/guards/supabase-auth.guard';
import { GetUser } from 'src/common/decorators/user.decorator';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('session')
  async createSession(): Promise<CreateSessionResponseDto> {
    return this.tasksService.createSession();
  }

  @UseGuards(SupabaseAuthGuard)
  @Sse('task-sse')
  createTaskSSE(
    @GetUser() user: any,
    @Query('sessionId') sessionId: string,
    @Query('prompt') prompt: string,
    @Query('url') url: string,
    @Query('workflowId') workflowId: string,
  ): Observable<MessageEvent> {
    return this.tasksService.createTaskSSE(
      sessionId,
      prompt,
      url,
      user.id,
      workflowId,
    );
  }
}
