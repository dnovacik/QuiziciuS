import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { MediaRefDto, QuestionType } from '@quizicius/shared-types';
import { SupabaseService } from '../supabase/supabase.service';

export interface QuestionRecord {
  id: string;
  quiz_id: string;
  /** Shown or played with the question. */
  media?: MediaRefDto | null;
  /** Shown or played at the answer reveal only. */
  reveal_media?: MediaRefDto | null;
  type: QuestionType;
  prompt: string;
  options: { id: string; label: string; isCorrect: boolean }[] | null;
  accepted_answers: string[] | null;
  correct_numeric: number | null;
  /** Numeric questions: the unit the answer is in (years, km, %). */
  unit?: string | null;
  points: number;
  time_limit_seconds: number;
  order_index: number;
}

export abstract class QuestionsRepository {
  abstract findById(id: string): Promise<QuestionRecord | null>;
  abstract listByQuiz(quizId: string): Promise<QuestionRecord[]>;
  abstract create(quizId: string, input: Omit<QuestionRecord, 'id' | 'quiz_id'>): Promise<QuestionRecord>;
  abstract update(quizId: string, id: string, input: Omit<QuestionRecord, 'id' | 'quiz_id'>): Promise<QuestionRecord | null>;
  abstract remove(quizId: string, id: string): Promise<boolean>;
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
    const { data, error } = await this.supabase.getClient().from('questions').select().eq('quiz_id', quizId).order('order_index');
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
  async update(quizId: string, id: string, input: Omit<QuestionRecord, 'id' | 'quiz_id'>): Promise<QuestionRecord | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('questions')
      .update(input)
      .eq('quiz_id', quizId)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    return data as QuestionRecord | null;
  }
  async remove(quizId: string, id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .getClient()
      .from('questions')
      .delete()
      .eq('quiz_id', quizId)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    return Boolean(data);
  }
}
