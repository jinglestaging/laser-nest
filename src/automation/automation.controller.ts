import { Body, Controller, Get, Param, Post, Sse } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { RunAutomationDto } from './dto/run-automation.dto';
import { RunAiAutomationDto } from './dto/run-ai-automation.dto';

@Controller('automation')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post('run')
  run(@Body() dto: RunAutomationDto) {
    return this.automationService.run(dto);
  }

  @Post('ai-run')
  runAi(@Body() dto: RunAiAutomationDto) {
    return this.automationService.runAi(dto);
  }

  @Post('three-agent-run')
  runThreeAgent(@Body() dto: RunAiAutomationDto) {
    return this.automationService.runThreeAgentAi(dto);
  }

  @Get('status/:jobId')
  status(@Param('jobId') jobId: string) {
    return this.automationService.getStatus(jobId);
  }

  @Post('stop/:jobId')
  stop(@Param('jobId') jobId: string) {
    return this.automationService.stop(jobId);
  }

  // Streams realtime updates (steps + jpeg frames) using Server-Sent Events.
  @Sse('stream/:jobId')
  stream(@Param('jobId') jobId: string) {
    return this.automationService.getStream(jobId);
  }
}


