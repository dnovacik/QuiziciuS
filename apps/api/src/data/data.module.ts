import { Global, Module } from '@nestjs/common';
import { AnswersRepository, SupabaseAnswersRepository } from './answers.repository';
import { QuestionsRepository, SupabaseQuestionsRepository } from './questions.repository';
import { SessionsRepository, SupabaseSessionsRepository } from './sessions.repository';
import { SupabaseTeamsRepository, TeamsRepository } from './teams.repository';

@Global()
@Module({
  providers: [
    { provide: SessionsRepository, useClass: SupabaseSessionsRepository },
    { provide: QuestionsRepository, useClass: SupabaseQuestionsRepository },
    { provide: TeamsRepository, useClass: SupabaseTeamsRepository },
    { provide: AnswersRepository, useClass: SupabaseAnswersRepository },
  ],
  exports: [SessionsRepository, QuestionsRepository, TeamsRepository, AnswersRepository],
})
export class DataModule {}
