import { Global, Module } from '@nestjs/common';
import { AnswersRepository, SupabaseAnswersRepository } from './answers.repository';
import { CategoriesRepository, SupabaseCategoriesRepository } from './categories.repository';
import { InfractionsRepository, SupabaseInfractionsRepository } from './infractions.repository';
import { ProfilesRepository, SupabaseProfilesRepository } from './profiles.repository';
import { PubsRepository, SupabasePubsRepository } from './pubs.repository';
import { LeaguesRepository, SupabaseLeaguesRepository } from './leagues.repository';
import { RegisteredTeamsRepository, SupabaseRegisteredTeamsRepository } from './registered-teams.repository';
import { QuestionsRepository, SupabaseQuestionsRepository } from './questions.repository';
import { QuizzesRepository, SupabaseQuizzesRepository } from './quizzes.repository';
import { ScoreAdjustmentsRepository, SupabaseScoreAdjustmentsRepository } from './score-adjustments.repository';
import { SessionsRepository, SupabaseSessionsRepository } from './sessions.repository';
import { SupabaseTeamsRepository, TeamsRepository } from './teams.repository';

@Global()
@Module({
  providers: [
    { provide: SessionsRepository, useClass: SupabaseSessionsRepository },
    { provide: QuestionsRepository, useClass: SupabaseQuestionsRepository },
    { provide: TeamsRepository, useClass: SupabaseTeamsRepository },
    { provide: AnswersRepository, useClass: SupabaseAnswersRepository },
    { provide: InfractionsRepository, useClass: SupabaseInfractionsRepository },
    { provide: QuizzesRepository, useClass: SupabaseQuizzesRepository },
    { provide: ScoreAdjustmentsRepository, useClass: SupabaseScoreAdjustmentsRepository },
    { provide: CategoriesRepository, useClass: SupabaseCategoriesRepository },
    { provide: PubsRepository, useClass: SupabasePubsRepository },
    { provide: ProfilesRepository, useClass: SupabaseProfilesRepository },
    { provide: RegisteredTeamsRepository, useClass: SupabaseRegisteredTeamsRepository },
    { provide: LeaguesRepository, useClass: SupabaseLeaguesRepository },
  ],
  exports: [
    SessionsRepository,
    QuestionsRepository,
    TeamsRepository,
    AnswersRepository,
    InfractionsRepository,
    QuizzesRepository,
    ScoreAdjustmentsRepository,
    CategoriesRepository,
    PubsRepository,
    ProfilesRepository,
    RegisteredTeamsRepository,
    LeaguesRepository,
  ],
})
export class DataModule {}
