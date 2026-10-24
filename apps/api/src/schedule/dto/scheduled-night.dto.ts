import { IsISO8601, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class ScheduledNightDto {
  /** When the night starts (ISO date-time with zone). */
  @IsISO8601({ strict: true })
  startsAt!: string;

  @IsString()
  pubId!: string;

  /** null or left out: the quiz is not chosen yet. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  quizId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  note?: string | null;
}
