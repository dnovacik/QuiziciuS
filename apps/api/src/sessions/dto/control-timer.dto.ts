import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TimerAction } from '../../quiz-engine/quiz-engine.service';

export class ControlTimerDto {
  @IsIn(['pause', 'resume', 'extend'])
  action!: TimerAction;

  /** `extend` only; 10 s when left out. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  seconds?: number;
}
