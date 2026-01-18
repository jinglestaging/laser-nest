import { IsString, IsOptional } from 'class-validator';

export class CreateWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  workflowData: string;
}
