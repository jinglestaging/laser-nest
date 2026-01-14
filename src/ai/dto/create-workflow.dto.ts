import { IsString, IsOptional, IsObject, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class NodeDataDto {
  @IsString()
  label: string;

  @IsString()
  stepType: string;

  @IsObject()
  params: any;
}

class NodeDto {
  @IsString()
  id: string;

  @IsString()
  type: string;

  @IsObject()
  position: { x: number; y: number };

  @ValidateNested()
  @Type(() => NodeDataDto)
  data: NodeDataDto;
}

class EdgeDto {
  @IsString()
  id: string;

  @IsString()
  source: string;

  @IsString()
  target: string;
}

class WorkflowDataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeDto)
  nodes: NodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EdgeDto)
  edges: EdgeDto[];
}

export class CreateWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateNested()
  @Type(() => WorkflowDataDto)
  workflowData: WorkflowDataDto;
}

