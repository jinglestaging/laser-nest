import { Controller, Post, Body, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { SupabaseAuthGuard } from 'src/common/guards/supabase-auth.guard';
import { GetUser } from 'src/common/decorators/user.decorator';
import { StreamChatDto } from './dto/stream-chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('stream')
  async streamChat(
    @GetUser() user: any,
    @Body() streamChatDto: StreamChatDto,
    @Res() res: Response,
  ) {
    return this.chatService.streamChat(streamChatDto.messages, res, user.id);
  }
}
