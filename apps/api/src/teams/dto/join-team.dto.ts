import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class JoinTeamDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** Where the team sits, e.g. "12" or "B3"; shown to the host. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  tableNumber?: string;

  @IsOptional()
  @IsIn(['IN_PERSON', 'REMOTE'])
  attendanceMode?: 'IN_PERSON' | 'REMOTE';
}
