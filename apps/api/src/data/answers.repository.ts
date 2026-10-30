import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GradedBy } from '@quizicius/shared-types';
import { SupabaseService } from '../supabase/supabase.service';

export interface AnswerRecord {
  id: string;
  session_id: string;
  question_id: string;
  team_id: string;
  response: unknown;
  is_correct: boolean | null;
  confidence: number | null;
  needs_review: boolean;
  graded_by: GradedBy | null;
  graded_at: string | null;
  submitted_at: string;
  score_awarded: number;
  /** When the team disputed its grade (at most once), and its note for the host. */
  disputed_at: string | null;
  dispute_note: string | null;
}

export type AnswerGradePatch = Partial<
  Pick<AnswerRecord, 'is_correct' | 'confidence' | 'needs_review' | 'graded_by' | 'graded_at' | 'score_awarded'>
>;

export abstract class AnswersRepository {
  abstract upsertSubmission(input: { sessionId: string; questionId: string; teamId: string; response: unknown }): Promise<AnswerRecord>;
  abstract findById(id: string): Promise<AnswerRecord | null>;
  abstract listByQuestion(sessionId: string, questionId: string): Promise<AnswerRecord[]>;
  abstract listNeedsReview(sessionId: string): Promise<AnswerRecord[]>;
  abstract listBySession(sessionId: string): Promise<AnswerRecord[]>;
  abstract updateGrade(id: string, patch: AnswerGradePatch): Promise<AnswerRecord>;
  abstract overrideGrade(id: string, hostId: string, isCorrect: boolean, points: number): Promise<AnswerRecord>;
  /** A team disputes its grade: the answer goes back to the host's review queue. */
  abstract markDisputed(id: string, note: string | null): Promise<AnswerRecord>;
}

@Injectable()
export class SupabaseAnswersRepository extends AnswersRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async upsertSubmission(input: { sessionId: string; questionId: string; teamId: string; response: unknown }): Promise<AnswerRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('answers')
      .upsert(
        {
          session_id: input.sessionId,
          question_id: input.questionId,
          team_id: input.teamId,
          response: input.response,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,question_id,team_id' },
      )
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as AnswerRecord;
  }

  async findById(id: string): Promise<AnswerRecord | null> {
    const { data, error } = await this.supabase.getClient().from('answers').select().eq('id', id).single();
    if (error) return null;
    return data as AnswerRecord;
  }

  async listByQuestion(sessionId: string, questionId: string): Promise<AnswerRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('answers')
      .select()
      .eq('session_id', sessionId)
      .eq('question_id', questionId);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as AnswerRecord[];
  }

  async listNeedsReview(sessionId: string): Promise<AnswerRecord[]> {
    const { data, error } = await this.supabase.getClient().from('answers').select().eq('session_id', sessionId).eq('needs_review', true);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as AnswerRecord[];
  }

  async listBySession(sessionId: string): Promise<AnswerRecord[]> {
    const { data, error } = await this.supabase.getClient().from('answers').select().eq('session_id', sessionId);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as AnswerRecord[];
  }

  async updateGrade(id: string, patch: AnswerGradePatch): Promise<AnswerRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('answers')
      .update({ ...patch, graded_at: patch.graded_at ?? new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as AnswerRecord;
  }

  async overrideGrade(id: string, hostId: string, isCorrect: boolean, points: number): Promise<AnswerRecord> {
    const { data, error } = await this.supabase.getClient().rpc('override_answer_grade', {
      p_answer_id: id,
      p_host_id: hostId,
      p_correct: isCorrect,
      p_points: points,
    });
    if (error) throw new InternalServerErrorException(error.message);
    return data as AnswerRecord;
  }

  async markDisputed(id: string, note: string | null): Promise<AnswerRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('answers')
      .update({ needs_review: true, disputed_at: new Date().toISOString(), dispute_note: note })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as AnswerRecord;
  }
}
