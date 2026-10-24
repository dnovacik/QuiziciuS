import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ScheduleController, TeamScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

/** Quiz nights planned ahead (date, pub, quiz, note), for hosts and the captains at those pubs. */
@Module({
  imports: [AuthModule],
  controllers: [ScheduleController, TeamScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
