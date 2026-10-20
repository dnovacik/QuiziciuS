import { IsString, MinLength } from 'class-validator';

export class CreateQuizDto {
  @IsString()
  @MinLength(1)
  title!: string;
}
