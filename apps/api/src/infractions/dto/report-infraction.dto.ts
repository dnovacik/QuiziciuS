import { IsIn } from 'class-validator';
import { INFRACTION_TYPES, InfractionType } from '@quizicius/shared-types';

export class ReportInfractionDto {
  @IsIn(INFRACTION_TYPES)
  type!: InfractionType;
}
