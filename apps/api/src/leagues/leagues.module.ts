import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuizEngineModule } from '../quiz-engine/quiz-engine.module';
import { LeaguesController } from './leagues.controller';
import { LeaguesService } from './leagues.service';

/** Leagues and Super Leagues: proposals, co-hosts, invitations, standings, closing. */
@Module({
  imports: [AuthModule, QuizEngineModule],
  controllers: [LeaguesController],
  providers: [LeaguesService],
  exports: [LeaguesService],
})
export class LeaguesModule {}
