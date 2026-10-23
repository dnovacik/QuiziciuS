import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class SetHostActiveDto {
  @IsBoolean()
  active!: boolean;
}

export class RenameTeamDto {
  @IsString()
  @Length(3, 30)
  name!: string;
}

/** Exactly one of the fields; the controller rejects anything else. */
export class SetSubscriptionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  extendMonths?: number;

  /** `YYYY-MM-DD`, the last day (inclusive). */
  @IsOptional()
  @IsISO8601({ strict: true })
  @Length(10, 10)
  until?: string;

  @IsOptional()
  @IsBoolean()
  forever?: boolean;
}
