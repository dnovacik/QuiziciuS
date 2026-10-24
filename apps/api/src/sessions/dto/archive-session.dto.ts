import { IsBoolean } from 'class-validator';

export class ArchiveSessionDto {
  @IsBoolean()
  archived!: boolean;
}
