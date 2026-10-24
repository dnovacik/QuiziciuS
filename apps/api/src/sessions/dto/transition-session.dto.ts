import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { QUIZ_STATES, QuizState } from '@quizicius/shared-types';

export class TransitionSessionDto {
  @IsIn(QUIZ_STATES)
  status!: QuizState;

  @IsOptional()
  @IsString()
  questionId?: string;

  /** PAUSE_BREAK only: planned length, shown as a countdown. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  breakMinutes?: number;

  /** PAUSE_BREAK only: a message for the projector and phones. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  breakMessage?: string;
}
