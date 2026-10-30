import { IsBoolean, IsInt, Min } from 'class-validator';

export class OverrideAnswerGradeDto {
  @IsBoolean()
  isCorrect!: boolean;

  @IsInt()
  @Min(0)
  points!: number;
}
