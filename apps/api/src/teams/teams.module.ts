import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TeamTokenGuard } from './team-token.guard';
import { TeamTokenService } from './team-token.service';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow('TEAM_TOKEN_SECRET') }),
    }),
  ],
  controllers: [TeamsController],
  providers: [TeamsService, TeamTokenService, TeamTokenGuard],
  exports: [TeamsService, TeamTokenService, TeamTokenGuard],
})
export class TeamsModule {}
