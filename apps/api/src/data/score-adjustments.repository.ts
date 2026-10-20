import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ScoreAdjustmentRecord {
  id: string;
  session_id: string;
  team_id: string;
  points: number;
  reason: string | null;
  created_at: string;
}

export abstract class ScoreAdjustmentsRepository {
  abstract create(sessionId: string, teamId: string, points: number, reason: string | null): Promise<ScoreAdjustmentRecord>;
  abstract listBySession(sessionId: string): Promise<ScoreAdjustmentRecord[]>;
}

@Injectable()
export class SupabaseScoreAdjustmentsRepository extends ScoreAdjustmentsRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async create(sessionId: string, teamId: string, points: number, reason: string | null): Promise<ScoreAdjustmentRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('score_adjustments')
      .insert({ session_id: sessionId, team_id: teamId, points, reason })
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as ScoreAdjustmentRecord;
  }

  async listBySession(sessionId: string): Promise<ScoreAdjustmentRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('score_adjustments')
      .select()
      .eq('session_id', sessionId);
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as ScoreAdjustmentRecord[];
  }
}
