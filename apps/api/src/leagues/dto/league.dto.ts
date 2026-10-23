import { ArrayMaxSize, ArrayMinSize, IsArray, IsISO8601, IsOptional, IsString, Length, ValidateIf } from 'class-validator';

export class CreateLeagueDto {
  @IsString() @Length(3, 60) name!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsString({ each: true }) pubIds!: string[];
  /** `YYYY-MM-DD`. */
  @IsISO8601({ strict: true }) @Length(10, 10) startsOn!: string;
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsISO8601({ strict: true }) @Length(10, 10) endsOn?: string | null;
  @IsOptional() @IsString() @Length(0, 500) message?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) inviteHostIds?: string[];
}

export class UpdateLeagueDto {
  @IsOptional() @IsString() @Length(3, 60) name?: string;
  @IsOptional() @IsISO8601({ strict: true }) @Length(10, 10) startsOn?: string;
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsISO8601({ strict: true }) @Length(10, 10) endsOn?: string | null;
  @IsOptional() @IsString() @Length(0, 500) message?: string;
}

export class AcceptLeagueDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsString({ each: true }) pubIds!: string[];
}
