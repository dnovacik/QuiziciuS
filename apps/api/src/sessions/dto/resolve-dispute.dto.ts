import { IsIn } from 'class-validator';

export class ResolveDisputeDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';
}
