import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

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
}
