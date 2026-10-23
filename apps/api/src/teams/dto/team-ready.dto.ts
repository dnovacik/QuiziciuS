import { IsBoolean } from 'class-validator';

export class TeamReadyDto {
  /** Whether the browser actually entered fullscreen when the team tapped ready. */
  @IsBoolean()
  fullscreen!: boolean;
}
