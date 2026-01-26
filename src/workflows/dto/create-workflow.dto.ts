import { IsString, IsOptional, IsUrl } from 'class-validator';

export class CreateWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  url?: string;

  @IsString()
  workflowData: string;
}
