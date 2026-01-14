import { IsString, IsOptional, IsObject } from 'class-validator';

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  workflowData?: {
    nodes: any[];
    edges: any[];
  };
}

