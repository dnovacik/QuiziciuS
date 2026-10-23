import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PubsModule } from '../pubs/pubs.module';
import { TeamsModule } from '../teams/teams.module';
import { RegisteredTeamsController } from './registered-teams.controller';
import { RegisteredTeamsService } from './registered-teams.service';

/** Permanent teams managed by their captain: profile, roster, pubs and joining quiz nights. */
@Module({
  imports: [AuthModule, PubsModule, TeamsModule],
  controllers: [RegisteredTeamsController],
  providers: [RegisteredTeamsService],
})
export class RegisteredTeamsModule {}
