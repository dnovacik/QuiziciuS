import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Length, Max, Min, ValidateIf } from 'class-validator';
import { MAX_TEAM_PUBS } from '../../pubs/pubs.service';

export const TEAM_BADGES = ['shield', 'crown', 'bolt', 'star', 'brain', 'trophy'] as const;
export const TEAM_COLORS = ['purple', 'amber', 'cyan', 'green', 'pink'] as const;

export class RegisterTeamDto {
  @IsString() @Length(3, 30) name!: string;
  @IsOptional() @IsString() @Length(0, 160) description?: string;
  @IsOptional() @IsIn(TEAM_BADGES) badge?: string;
  @IsOptional() @IsIn(TEAM_COLORS) color?: string;
  @IsInt() @Min(2) @Max(6) expectedMembers!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_TEAM_PUBS) @IsString({ each: true }) pubIds?: string[];
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsString() primaryPubId?: string | null;
}

export class EditTeamDto {
  @IsOptional() @IsString() @Length(3, 30) name?: string;
  @IsOptional() @IsString() @Length(0, 160) description?: string;
  @IsOptional() @IsIn(TEAM_BADGES) badge?: string;
  @IsOptional() @IsIn(TEAM_COLORS) color?: string;
  @IsOptional() @IsInt() @Min(2) @Max(6) expectedMembers?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_TEAM_PUBS) @IsString({ each: true }) pubIds?: string[];
  @IsOptional() @ValidateIf((_, value) => value !== null) @IsString() primaryPubId?: string | null;
}

export class PlayerDto {
  @IsString() @Length(1, 60) name!: string;
}
