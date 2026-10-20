import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface QuizRecord {
  id: string;
  host_id: string;
  league_id: string | null;
  title: string;
  created_at: string;
}

export abstract class QuizzesRepository {
  abstract create(hostId: string, title: string): Promise<QuizRecord>;
  abstract findById(id: string): Promise<QuizRecord | null>;
  abstract listByHost(hostId: string): Promise<QuizRecord[]>;
}

@Injectable()
export class SupabaseQuizzesRepository extends QuizzesRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async create(hostId: string, title: string): Promise<QuizRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('quizzes')
      .insert({ host_id: hostId, title })
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
}
