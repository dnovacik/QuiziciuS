import { AnswerSummaryDto } from '@quizicius/shared-types';
import { AnswerRecord } from '../data/answers.repository';

/** API shape of an answer; `includeGrade: false` blanks the grading fields. */
export function toAnswerSummary(answer: AnswerRecord, includeGrade = true): AnswerSummaryDto {
  return {
    id: answer.id,
    sessionId: answer.session_id,
    questionId: answer.question_id,
    teamId: answer.team_id,
    response: answer.response,
    isCorrect: includeGrade ? answer.is_correct : null,
    confidence: includeGrade ? answer.confidence : null,
    needsReview: includeGrade ? answer.needs_review : false,
    gradedBy: includeGrade ? answer.graded_by : null,
    scoreAwarded: includeGrade ? answer.score_awarded : 0,
  };
}
