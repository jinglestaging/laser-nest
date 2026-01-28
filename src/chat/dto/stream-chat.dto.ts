import {
  IsArray,
  IsString,
  IsIn,
  IsNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  TOOL = 'tool',
}

export class MessageDto {
  @IsString()
  @IsIn(Object.values(MessageRole))
  role: MessageRole;

  @IsNotEmpty()
  content: string | ContentPart[];
}

export interface ContentPart {
  type: string;
  text?: string;
  image_url?: { url: string };
}

export class StreamChatDto {
  @IsArray()
  @IsNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];
}
