import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { QUESTION_TYPES, QuestionType } from '@quizicius/shared-types';

export class CreateQuestionDto {
  @IsIn(QUESTION_TYPES)
  type!: QuestionType;

  @IsOptional()
  @IsIn(['image', 'video'])
  mediaType?: 'image' | 'video' | null;

  @IsOptional()
  @IsString()
  mediaPath?: string | null;

  @IsString()
  prompt!: string;

  @IsOptional()
  @IsArray()
  options?: { id: string; label: string; isCorrect: boolean }[];

  @IsOptional()
  @IsArray()
  acceptedAnswers?: string[];

  @IsOptional()
  @IsNumber()
  correctNumeric?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  /** 0 means no timer: answering stays open until the host closes it. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  timeLimitSeconds?: number;

  @IsInt()
  @Min(0)
  orderIndex!: number;
}
