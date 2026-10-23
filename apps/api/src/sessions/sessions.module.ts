import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeaguesModule } from '../leagues/leagues.module';
import { PubsModule } from '../pubs/pubs.module';
import { QuizEngineModule } from '../quiz-engine/quiz-engine.module';
import { SessionsController } from './sessions.controller';

@Module({
  imports: [AuthModule, QuizEngineModule, PubsModule, LeaguesModule],
  controllers: [SessionsController],
})
export class SessionsModule {}
