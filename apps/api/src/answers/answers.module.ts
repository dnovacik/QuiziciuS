import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { AnswersController } from './answers.controller';
import { AnswersService } from './answers.service';

@Module({
  imports: [TeamsModule],
  controllers: [AnswersController],
  providers: [AnswersService],
})
export class AnswersModule {}
