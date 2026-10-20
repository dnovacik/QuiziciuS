import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TeamsModule } from '../teams/teams.module';
import { InfractionsController } from './infractions.controller';
import { InfractionsService } from './infractions.service';

@Module({
  imports: [AuthModule, TeamsModule],
  controllers: [InfractionsController],
  providers: [InfractionsService],
})
export class InfractionsModule {}
