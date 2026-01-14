import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RunAiAutomationDto {
  @IsString()
  @MaxLength(4000)
  prompt!: string;

  /**
   * Optional initial URL to open before the agent starts acting.
   * If omitted, the agent may choose to navigate as its first action.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  start_url?: string;

  @IsOptional()
  @IsBoolean()
  headless?: boolean;

  /**
   * Hard safety limit to prevent infinite loops.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  max_steps?: number;
}


