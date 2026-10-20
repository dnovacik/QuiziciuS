import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnswersModule } from './answers/answers.module';
import { validateEnv } from './config/env.validation';
import { DataModule } from './data/data.module';
import { InfractionsModule } from './infractions/infractions.module';
import { QuestionsModule } from './questions/questions.module';
import { QuizEngineModule } from './quiz-engine/quiz-engine.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SessionsModule } from './sessions/sessions.module';
import { SupabaseModule } from './supabase/supabase.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    SupabaseModule,
    DataModule,
    RealtimeModule,
    QuizEngineModule,
    TeamsModule,
    AnswersModule,
    InfractionsModule,
    QuizzesModule,
    QuestionsModule,
    SessionsModule,
  ],
})
export class AppModule {}
