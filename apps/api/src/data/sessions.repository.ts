import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { QuizState } from '@quizicius/shared-types';
import { SupabaseService } from '../supabase/supabase.service';

export interface SessionRecord {
  id: string;
  quiz_id: string;
  host_id: string;
  join_code: string;
  status: QuizState;
  scores_visible?: boolean;
  pub_id: string | null;
  /** The league this night counts for, ticked at launch. */
  league_id: string | null;
  current_question_id: string | null;
  question_ends_at: string | null;
  /** Set while the host has paused the question's timer; the deadline moves on at resume. */
  question_paused_at: string | null;
  /** The break's planned end and the host's message for the room; only during PAUSE_BREAK. */
  break_ends_at: string | null;
  break_message: string | null;
  /** Questions shown so far, in order; every device running the night picks the next from this. */
  played_question_ids?: string[];
  /** A finished night the host filed away; hidden from the sessions list by default. */
  archived_at?: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export type SessionStatusPatch = Partial<
  Pick<
    SessionRecord,
    | 'scores_visible'
    | 'status'
    | 'current_question_id'
    | 'question_ends_at'
    | 'question_paused_at'
    | 'break_ends_at'
    | 'break_message'
    | 'played_question_ids'
    | 'archived_at'
    | 'started_at'
    | 'finished_at'
  >
>;

export abstract class SessionsRepository {
  abstract create(
    quizId: string,
    hostId: string,
    joinCode: string,
    pubId?: string | null,
    leagueId?: string | null,
  ): Promise<SessionRecord>;
  /** Every quiz night ticked for the league, oldest first. */
  abstract listByLeague(leagueId: string): Promise<SessionRecord[]>;
  /** Finished quiz nights played at the pub, oldest first. */
  abstract listFinishedByPub(pubId: string): Promise<SessionRecord[]>;
  abstract findById(id: string): Promise<SessionRecord | null>;
  abstract listByHost(hostId: string): Promise<SessionRecord[]>;
  /**
   * Resolves a spoken-aloud join code to its session. Join codes are only unique
   * among sessions that are still joinable (see the partial unique index in
   * `0001_init.sql`), so finished sessions are excluded to match that guarantee.
   */
  abstract findByJoinCode(joinCode: string): Promise<SessionRecord | null>;
  abstract updateStatus(id: string, patch: SessionStatusPatch): Promise<SessionRecord>;
}

@Injectable()
export class SupabaseSessionsRepository extends SessionsRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async create(
    quizId: string,
    hostId: string,
    joinCode: string,
    pubId: string | null = null,
    leagueId: string | null = null,
  ): Promise<SessionRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('quiz_sessions')
      .insert({ quiz_id: quizId, host_id: hostId, join_code: joinCode, status: 'LOBBY', pub_id: pubId, league_id: leagueId })
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as SessionRecord;
  }

  async listByHost(hostId: string): Promise<SessionRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('quiz_sessions')
      .select()
      .eq('host_id', hostId)
      .order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as SessionRecord[];
  }

  async listByLeague(leagueId: string): Promise<SessionRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('quiz_sessions')
      .select()
      .eq('league_id', leagueId)
      .order('created_at', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as SessionRecord[];
  }

  async listFinishedByPub(pubId: string): Promise<SessionRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('quiz_sessions')
      .select()
      .eq('pub_id', pubId)
      .eq('status', 'FINISHED')
      .order('finished_at', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as SessionRecord[];
  }

  async findById(id: string): Promise<SessionRecord | null> {
    const { data, error } = await this.supabase.getClient().from('quiz_sessions').select().eq('id', id).single();
    if (error) return null;
    return data as SessionRecord;
  }

  async findByJoinCode(joinCode: string): Promise<SessionRecord | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('quiz_sessions')
      .select()
      .eq('join_code', joinCode)
      .neq('status', 'FINISHED')
      .single();
    if (error) return null;
    return (data as SessionRecord) ?? null;
  }

  async updateStatus(id: string, patch: SessionStatusPatch): Promise<SessionRecord> {
    const { data, error } = await this.supabase.getClient().from('quiz_sessions').update(patch).eq('id', id).select().single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as SessionRecord;
  }
}
