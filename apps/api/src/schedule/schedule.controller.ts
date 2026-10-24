import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { RequireRole } from '../auth/require-role';
import { ScheduledNightDto } from './dto/scheduled-night.dto';
import { ScheduleService } from './schedule.service';

/** The host's quiz nights planned ahead. */
@Controller('host/schedule')
@RequireRole('HOST')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get()
  list(@CurrentHost() host: CurrentHostPayload) {
    return this.schedule.listForHost(host.id);
  }

  @Post()
  create(@CurrentHost() host: CurrentHostPayload, @Body() dto: ScheduledNightDto) {
    return this.schedule.create(host.id, dto);
  }

  @Put(':id')
  update(@CurrentHost() host: CurrentHostPayload, @Param('id') id: string, @Body() dto: ScheduledNightDto) {
    return this.schedule.update(host.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentHost() host: CurrentHostPayload, @Param('id') id: string): Promise<void> {
    return this.schedule.remove(host.id, id);
  }
}

/** A captain's view: what is coming up at the team's pubs. */
@Controller('registered-teams')
@RequireRole('TEAM_CAPTAIN')
export class TeamScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get(':id/schedule')
  forTeam(@CurrentHost() user: CurrentHostPayload, @Param('id') id: string) {
    return this.schedule.forTeam(user.id, id);
  }
}
