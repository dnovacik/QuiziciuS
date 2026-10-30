import { IsBoolean } from 'class-validator';

export class ScoreVisibilityDto {
  @IsBoolean()
  visible!: boolean;
}
