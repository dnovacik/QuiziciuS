import { IsString, MaxLength } from 'class-validator';

export class ImportQuestionsDto {
  /** The CSV file's text, as described in question-csv.ts. */
  @IsString()
  @MaxLength(200_000)
  csv!: string;
}
