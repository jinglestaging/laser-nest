import {
  Controller,
  Post,
  Sse,
  MessageEvent,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { TasksService } from './tasks.service';
import { CreateSessionResponseDto } from './dto/create-session-response.dto';
import { CreateTaskQueryDto } from './dto/create-task-query.dto';
import { SupabaseAuthGuard } from 'src/common/guards/supabase-auth.guard';
import { GetUser } from 'src/common/decorators/user.decorator';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('session')
  async createSession(): Promise<CreateSessionResponseDto> {
    return this.tasksService.createSession();
  }

  @UseGuards(SupabaseAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @Sse('task-sse')
  createTaskSSE(
    @GetUser() user: SupabaseUser,
    @Query() query: CreateTaskQueryDto,
  ): Observable<MessageEvent> {
    return this.tasksService.createTaskSSE(
      query.sessionId,
      query.prompt,
      query.url ?? '',
      user.id,
      query.workflowId,
    );
  }
}
