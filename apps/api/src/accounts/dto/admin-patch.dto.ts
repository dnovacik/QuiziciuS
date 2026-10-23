import { IsBoolean, IsString, Length } from 'class-validator';

export class SetHostActiveDto {
  @IsBoolean()
  active!: boolean;
}

export class RenameTeamDto {
  @IsString()
  @Length(3, 30)
  name!: string;
}
