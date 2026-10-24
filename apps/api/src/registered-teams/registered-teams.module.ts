import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeaguesModule } from '../leagues/leagues.module';
import { PubsModule } from '../pubs/pubs.module';
import { TeamsModule } from '../teams/teams.module';
import { RegisteredTeamsController, TeamAccessController } from './registered-teams.controller';
import { RegisteredTeamsService } from './registered-teams.service';

/** Permanent teams managed by their captain: profile, roster, pubs and joining quiz nights. */
@Module({
  imports: [AuthModule, PubsModule, TeamsModule, LeaguesModule],
  controllers: [RegisteredTeamsController, TeamAccessController],
  providers: [RegisteredTeamsService],
})
export class RegisteredTeamsModule {}
