import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ScheduledNightDto as ScheduledNightView, TeamScheduledNightDto } from '@quizicius/shared-types';
import { PubsRepository } from '../data/pubs.repository';
import { QuizzesRepository } from '../data/quizzes.repository';
import { RegisteredTeamsRepository } from '../data/registered-teams.repository';
import { ScheduledNightInput, ScheduledNightRecord, ScheduledNightsRepository } from '../data/scheduled-nights.repository';
import { ProfilesRepository } from '../data/profiles.repository';
import { ScheduledNightDto } from './dto/scheduled-night.dto';

/** A night counts as upcoming until a few hours after it started, so tonight's stays on the list. */
const STILL_ON_MS = 6 * 60 * 60_000;

/** Quiz nights planned ahead: the host's plan, and the nights coming up at a team's pubs. */
@Injectable()
export class ScheduleService {
  constructor(
    private readonly nights: ScheduledNightsRepository,
    private readonly pubs: PubsRepository,
    private readonly quizzes: QuizzesRepository,
    private readonly teams: RegisteredTeamsRepository,
    private readonly profiles: ProfilesRepository,
  ) {}

  private since(): string {
    return new Date(Date.now() - STILL_ON_MS).toISOString();
  }

  async listForHost(hostId: string): Promise<ScheduledNightView[]> {
    const rows = await this.nights.listByHost(hostId, this.since());
    return Promise.all(rows.map((row) => this.view(row)));
  }

  async create(hostId: string, dto: ScheduledNightDto): Promise<ScheduledNightView> {
    return this.view(await this.nights.create(hostId, await this.input(hostId, dto)));
  }

  async update(hostId: string, id: string, dto: ScheduledNightDto): Promise<ScheduledNightView> {
    await this.own(hostId, id);
    return this.view(await this.nights.update(id, await this.input(hostId, dto)));
  }

  async remove(hostId: string, id: string): Promise<void> {
    await this.own(hostId, id);
    await this.nights.remove(id);
  }

  /** The nights coming up at the captain's team's pubs, soonest first. */
  async forTeam(captainId: string, teamId: string): Promise<TeamScheduledNightDto[]> {
    const team = await this.teams.findById(teamId);
    if (!team || team.captain_id !== captainId) throw new NotFoundException({ code: 'TEAM_NOT_FOUND', message: 'Team not found' });
    const pubs = await this.pubs.listForTeam(teamId);
    const rows = await this.nights.listByPubs(
      pubs.map((pub) => pub.id),
      this.since(),
    );
    return Promise.all(
      rows.map(async (row) => {
        const view = await this.view(row);
        const host = await this.profiles.findById(row.host_id);
        return {
          id: view.id,
          startsAt: view.startsAt,
          pub: view.pub,
          quizTitle: view.quizTitle,
          note: view.note,
          hostName: host?.display_name ?? null,
        };
      }),
    );
  }

  private async own(hostId: string, id: string): Promise<ScheduledNightRecord> {
    const row = await this.nights.findById(id);
    if (!row || row.host_id !== hostId) throw new NotFoundException({ code: 'NIGHT_NOT_FOUND', message: 'Scheduled night not found' });
    return row;
  }

  /** Checks the pub is one of the host's and the quiz is the host's own. */
  private async input(hostId: string, dto: ScheduledNightDto): Promise<ScheduledNightInput> {
    const hostPubs = await this.pubs.listForHost(hostId);
    if (!hostPubs.some((pub) => pub.id === dto.pubId)) {
      throw new BadRequestException({ code: 'PUB_NOT_YOURS', message: 'Add the pub to your pubs first' });
    }
    if (dto.quizId) {
      const quiz = await this.quizzes.findById(dto.quizId);
      if (!quiz || quiz.host_id !== hostId) throw new ForbiddenException({ code: 'QUIZ_NOT_YOURS', message: 'Not your quiz' });
    }
    return {
      pub_id: dto.pubId,
      quiz_id: dto.quizId ?? null,
      starts_at: new Date(dto.startsAt).toISOString(),
      note: dto.note?.trim() || null,
    };
  }

  private async view(row: ScheduledNightRecord): Promise<ScheduledNightView> {
    const [pub, quiz] = await Promise.all([
      this.pubs.findById(row.pub_id),
      row.quiz_id ? this.quizzes.findById(row.quiz_id) : Promise.resolve(null),
    ]);
    return {
      id: row.id,
      startsAt: row.starts_at,
      pub: pub ? { id: pub.id, name: pub.name, city: pub.city } : null,
      quizId: row.quiz_id,
      quizTitle: quiz?.title ?? null,
      note: row.note,
    };
  }
}
