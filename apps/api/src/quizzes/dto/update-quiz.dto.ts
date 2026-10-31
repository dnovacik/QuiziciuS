import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const MAX_ROUNDS = 30;

export class QuizRoundInput {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title!: string;

  @IsInt()
  @Min(1)
  @Max(500)
  questionCount!: number;

  /** The coffee break after the round; 0 = none. */
  @IsInt()
  @Min(0)
  @Max(120)
  breakMinutes!: number;
}

export class UpdateQuizDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  /** null clears the category. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  categoryId?: string | null;

  /** null clears the default pub. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  pubId?: string | null;

  /** Answer time new questions start with; 0 = no timer. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  defaultTimeLimitSeconds?: number;

  /** Replaces the quiz's rounds; [] removes them. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ROUNDS)
  @ValidateNested({ each: true })
  @Type(() => QuizRoundInput)
  rounds?: QuizRoundInput[];
}
