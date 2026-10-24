import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DisputeAnswerDto {
  /** Why the team thinks it was right, for the host. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
