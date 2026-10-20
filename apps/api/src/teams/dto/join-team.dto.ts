import { IsString, MinLength } from 'class-validator';

export class JoinTeamDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
