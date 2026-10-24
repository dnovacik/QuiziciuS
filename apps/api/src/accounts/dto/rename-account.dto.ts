import { IsString, MaxLength } from 'class-validator';

export class RenameAccountDto {
  /** Empty resets the name to the e-mail. */
  @IsString()
  @MaxLength(60)
  displayName!: string;
}
