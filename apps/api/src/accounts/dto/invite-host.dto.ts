import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class InviteHostDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  displayName?: string;
}
