import { IsOptional, IsString, Length } from 'class-validator';

export class AddPubDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsString()
  @Length(2, 60)
  city!: string;

  @IsOptional()
  @IsString()
  @Length(0, 160)
  address?: string;
}
