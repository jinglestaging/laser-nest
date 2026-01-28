import { Controller, Post, Body, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { SupabaseAuthGuard } from 'src/common/guards/supabase-auth.guard';
import { StreamChatDto } from './dto/stream-chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('stream')
  async streamChat(
    @Body() streamChatDto: StreamChatDto,
    @Res() res: Response,
  ): Promise<void> {
    return this.chatService.streamChat(streamChatDto.messages, res);
  }
}
