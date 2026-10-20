import { IsIn, IsOptional, IsString } from 'class-validator';
import { QUIZ_STATES, QuizState } from '@quizicius/shared-types';

export class TransitionSessionDto {
  @IsIn(QUIZ_STATES)
  status!: QuizState;

  @IsOptional()
  @IsString()
  questionId?: string;
}
