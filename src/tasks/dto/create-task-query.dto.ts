import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsUrl,
  IsOptional,
} from 'class-validator';

export class CreateTaskQueryDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsString()
  @IsUrl({}, { message: 'url must be a valid URL' })
  @IsOptional()
  url?: string;

  @IsUUID('4', { message: 'workflowId must be a valid UUID' })
  workflowId: string;
}
