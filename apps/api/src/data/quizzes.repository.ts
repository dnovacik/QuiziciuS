import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface QuizRecord {
  id: string;
  host_id: string;
  league_id: string | null;
  category_id: string | null;
  /** Default pub new sessions of this quiz are played at. */
  pub_id: string | null;
  title: string;
  created_at: string;
}

export abstract class QuizzesRepository {
  abstract create(hostId: string, title: string, categoryId: string | null, pubId?: string | null): Promise<QuizRecord>;
  abstract findById(id: string): Promise<QuizRecord | null>;
  abstract listByHost(hostId: string): Promise<QuizRecord[]>;
  abstract update(id: string, patch: QuizPatch): Promise<QuizRecord>;
  abstract remove(id: string): Promise<void>;
}

export type QuizPatch = Partial<Pick<QuizRecord, 'title' | 'category_id' | 'pub_id'>>;

@Injectable()
export class SupabaseQuizzesRepository extends QuizzesRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async create(hostId: string, title: string, categoryId: string | null, pubId: string | null = null): Promise<QuizRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('quizzes')
      .insert({ host_id: hostId, title, category_id: categoryId, pub_id: pubId })
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as QuizRecord;
  }

  async findById(id: string): Promise<QuizRecord | null> {
    const { data, error } = await this.supabase.getClient().from('quizzes').select().eq('id', id).single();
    if (error) return null;
    return data as QuizRecord;
  }

  async listByHost(hostId: string): Promise<QuizRecord[]> {
    const { data, error } = await this.supabase.getClient().from('quizzes').select().eq('host_id', hostId);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as QuizRecord[];
  }

  async update(id: string, patch: QuizPatch): Promise<QuizRecord> {
    const { data, error } = await this.supabase.getClient().from('quizzes').update(patch).eq('id', id).select().single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as QuizRecord;
  }

  /** Deletes the quiz; questions, sessions and their answers cascade in the database. */
  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.getClient().from('quizzes').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
  }
}
