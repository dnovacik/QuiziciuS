import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
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

export interface SubmissionInput {
  sessionId: string;
  questionId: string;
  teamId: string;
  response: unknown;
  /** How long after the question's deadline a submission still counts. */
  graceMs: number;
}

export abstract class AnswersRepository {
  /** Saves the team's answer, only while the question is open: checked and written atomically against a reveal. */
  abstract upsertSubmission(input: SubmissionInput): Promise<AnswerRecord>;
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

  async upsertSubmission(input: SubmissionInput): Promise<AnswerRecord> {
    const { data, error } = await this.supabase.getClient().rpc('submit_answer', {
      p_session_id: input.sessionId,
      p_question_id: input.questionId,
      p_team_id: input.teamId,
      p_response: input.response,
      p_grace_ms: input.graceMs,
    });
    if (error) {
      if (error.message.includes('QUESTION_NOT_ACTIVE')) throw new BadRequestException('This question is not currently active');
      if (error.message.includes('SUBMISSION_CLOSED')) throw new UnprocessableEntityException('Submission window has closed');
      if (error.message.includes('SESSION_NOT_FOUND')) throw new NotFoundException('Session not found');
      throw new InternalServerErrorException(error.message);
    }
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
