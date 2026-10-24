import { IsArray, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { QUESTION_TYPES, QuestionType } from '@quizicius/shared-types';

export class CreateQuestionDto {
  @IsIn(QUESTION_TYPES)
  type!: QuestionType;

  /** A MediaRef, checked and normalised by normalizeMediaRef. */
  @IsOptional()
  @IsObject()
  media?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  revealMedia?: Record<string, unknown> | null;

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

  /** Numeric questions only: the unit, e.g. "km". */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

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
