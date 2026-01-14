import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RunAutomationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;
}


