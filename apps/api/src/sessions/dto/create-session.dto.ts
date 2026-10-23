import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class CreateSessionDto {
  /** The pub this session is played at; omitted uses the quiz's default pub, null means none. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  pubId?: string | null;
}
