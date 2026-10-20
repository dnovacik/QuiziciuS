import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { QuestionType } from '@quizicius/shared-types';
import { SupabaseService } from '../supabase/supabase.service';

export interface QuestionRecord {
  id: string;
  quiz_id: string;
  type: QuestionType;
  prompt: string;
  options: { id: string; label: string; isCorrect: boolean }[] | null;
  accepted_answers: string[] | null;
  correct_numeric: number | null;
  points: number;
  time_limit_seconds: number;
  order_index: number;
}

export abstract class QuestionsRepository {
  abstract findById(id: string): Promise<QuestionRecord | null>;
  abstract listByQuiz(quizId: string): Promise<QuestionRecord[]>;
  abstract create(quizId: string, input: Omit<QuestionRecord, 'id' | 'quiz_id'>): Promise<QuestionRecord>;
}

@Injectable()
export class SupabaseQuestionsRepository extends QuestionsRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async findById(id: string): Promise<QuestionRecord | null> {
    const { data, error } = await this.supabase.getClient().from('questions').select().eq('id', id).single();
    if (error) return null;
    return data as QuestionRecord;
  }

  async listByQuiz(quizId: string): Promise<QuestionRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('questions')
      .select()
      .eq('quiz_id', quizId)
      .order('order_index');
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as QuestionRecord[];
  }

  async create(quizId: string, input: Omit<QuestionRecord, 'id' | 'quiz_id'>): Promise<QuestionRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('questions')
      .insert({ quiz_id: quizId, ...input })
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as QuestionRecord;
  }
}
