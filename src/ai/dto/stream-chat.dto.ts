import { IsArray, IsString, IsIn, IsNotEmpty } from 'class-validator';

// Simple DTO without strict validation for content
// This allows both string content and vision array content
class MessageDto {
  @IsString()
  @IsIn(['user', 'assistant', 'system', 'tool'])
  role: string;

  @IsNotEmpty()
  content: any; // Can be string OR array of content parts (for vision)
}

export class StreamChatDto {
  @IsArray()
  @IsNotEmpty()
  messages: MessageDto[];
}
