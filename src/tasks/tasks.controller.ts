import { Controller, Post, Body } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { CreateSessionResponseDto } from './dto/create-session-response.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('session')
  async createSession(): Promise<CreateSessionResponseDto> {
    return this.tasksService.createSession();
  }

  @Post('task')
  async createTask(@Body() createTaskDto: CreateTaskDto) {
    const { sessionId, prompt } = createTaskDto;
    return this.tasksService.createTask(sessionId, prompt);
  }
}
