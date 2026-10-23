import { IsIn } from 'class-validator';
import { MediaAction, MediaSlot } from '@quizicius/shared-types';

export class MediaControlDto {
  @IsIn(['question', 'reveal'])
  slot!: MediaSlot;

  @IsIn(['play', 'pause', 'replay'])
  action!: MediaAction;
}
