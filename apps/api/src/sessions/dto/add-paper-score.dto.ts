import { IsInt, IsOptional, IsString } from 'class-validator';

export class AddPaperScoreDto {
  @IsInt()
  points!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
