import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { QuizState } from '@quizicius/shared-types';
import { SupabaseService } from '../supabase/supabase.service';

export interface SessionRecord {
  id: string;
  quiz_id: string;
  host_id: string;
  join_code: string;
  status: QuizState;
  current_question_id: string | null;
  question_ends_at: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export type SessionStatusPatch = Partial<
  Pick<SessionRecord, 'status' | 'current_question_id' | 'question_ends_at' | 'started_at' | 'finished_at'>
>;

export abstract class SessionsRepository {
  abstract create(quizId: string, hostId: string, joinCode: string): Promise<SessionRecord>;
  abstract findById(id: string): Promise<SessionRecord | null>;
  abstract updateStatus(id: string, patch: SessionStatusPatch): Promise<SessionRecord>;
}

@Injectable()
export class SupabaseSessionsRepository extends SessionsRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async create(quizId: string, hostId: string, joinCode: string): Promise<SessionRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('quiz_sessions')
      .insert({ quiz_id: quizId, host_id: hostId, join_code: joinCode, status: 'LOBBY' })
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as SessionRecord;
  }

  async findById(id: string): Promise<SessionRecord | null> {
    const { data, error } = await this.supabase.getClient().from('quiz_sessions').select().eq('id', id).single();
    if (error) return null;
    return data as SessionRecord;
  }

  async updateStatus(id: string, patch: SessionStatusPatch): Promise<SessionRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('quiz_sessions')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as SessionRecord;
  }
}
