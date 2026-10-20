import { IsObject, IsString } from 'class-validator';

export class SubmitAnswerDto {
  @IsString()
  questionId!: string;

  @IsObject()
  response!: { optionId?: string; text?: string; value?: number };
}
