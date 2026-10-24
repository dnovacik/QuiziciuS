import { IsInt, IsOptional, IsString, Max, Min, MinLength, ValidateIf } from 'class-validator';

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
}
