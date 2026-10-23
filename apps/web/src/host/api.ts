import type { AnswerSummaryDto, MediaAction, MediaRefDto, MediaSlot, QuestionType, QuizState } from '@quizicius/shared-types';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client';
import { uploadMimeType } from '../lib/media-ref';
import { supabase } from '../lib/supabase-client';

export interface Quiz {
  id: string;
  title: string;
  category_id: string | null;
  pub_id: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface HostSession {
  id: string;
  quiz_id: string;
  join_code: string;
  status: QuizState;
  pub_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface QuestionOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  quiz_id: string;
  type: QuestionType;
  prompt: string;
  /** Shown or played with the question. */
  media: MediaRefDto | null;
  /** Shown or played at the answer reveal only. */
  reveal_media: MediaRefDto | null;
  options: QuestionOption[] | null;
  accepted_answers: string[] | null;
  correct_numeric: number | null;
  points: number;
  time_limit_seconds: number;
  order_index: number;
}

export type QuestionDraft = Omit<Question, 'id' | 'quiz_id'>;

export interface Infraction {
  id: string;
  team_id: string;
  type: string;
}

/** The questions API takes the full question on every write (camelCase body). */
function toPayload(question: QuestionDraft) {
  return {
    type: question.type,
    media: question.media,
    revealMedia: question.reveal_media,
    prompt: question.prompt.trim(),
    options: question.type === 'MULTIPLE_CHOICE' ? question.options : undefined,
    acceptedAnswers: question.type === 'FREE_TEXT' ? question.accepted_answers?.map((answer) => answer.trim()) : undefined,
    correctNumeric: question.type === 'NUMERIC_NEAREST' ? (question.correct_numeric ?? undefined) : undefined,
    points: question.points,
    timeLimitSeconds: question.time_limit_seconds,
    orderIndex: question.order_index,
  };
}

export function stripIds(question: Question): QuestionDraft {
  const { id: _id, quiz_id: _quizId, ...draft } = question;
  return draft;
}

export const hostApi = {
  listQuizzes: (token: string) => apiGet<Quiz[]>('/quizzes', token),
  listCategories: (token: string) => apiGet<Category[]>('/categories', token),
  createQuiz: (token: string, title: string, categoryId: string | null, pubId: string | null = null) =>
    apiPost<Quiz>('/quizzes', { title: title.trim(), categoryId: categoryId ?? undefined, pubId: pubId ?? undefined }, token),
  updateQuiz: (token: string, quizId: string, patch: { title?: string; categoryId?: string | null; pubId?: string | null }) =>
    apiPatch<Quiz>(`/quizzes/${quizId}`, patch, token),
  deleteQuiz: (token: string, quizId: string) => apiDelete<void>(`/quizzes/${quizId}`, token),

  listQuestions: (token: string, quizId: string) => apiGet<Question[]>(`/quizzes/${quizId}/questions`, token),
  createQuestion: (token: string, quizId: string, draft: QuestionDraft) =>
    apiPost<Question>(`/quizzes/${quizId}/questions`, toPayload(draft), token),
  updateQuestion: (token: string, quizId: string, questionId: string, draft: QuestionDraft) =>
    apiPatch<Question>(`/quizzes/${quizId}/questions/${questionId}`, toPayload(draft), token),
  deleteQuestion: (token: string, quizId: string, questionId: string) => apiDelete(`/quizzes/${quizId}/questions/${questionId}`, token),
  mediaUrl: (token: string, quizId: string, path: string) =>
    apiGet<{ url: string }>(`/quizzes/${quizId}/questions/media/url?path=${encodeURIComponent(path)}`, token).then((row) => row.url),

  listSessions: (token: string) => apiGet<HostSession[]>('/host/sessions', token),
  getSession: (token: string, sessionId: string) => apiGet<HostSession>(`/host/sessions/${sessionId}`, token),
  /** `pubId` null launches without a pub; the API falls back to the quiz's pub only when it is omitted. */
  createSession: (token: string, quizId: string, pubId: string | null, leagueId: string | null = null) =>
    apiPost<HostSession>(`/quizzes/${quizId}/sessions`, leagueId ? { pubId, leagueId } : { pubId }, token),
  transition: (token: string, sessionId: string, status: QuizState, questionId?: string) =>
    apiPost(`/sessions/${sessionId}/transition`, status === 'LOCK_IN_ROUND' ? { status, questionId } : { status }, token),
  /** Plays, pauses or replays a media slot of the current question on the projector. */
  mediaControl: (token: string, sessionId: string, slot: MediaSlot, action: MediaAction) =>
    apiPost(`/sessions/${sessionId}/media/control`, { slot, action }, token),
  /** Ends answering for the open question now (untimed, or a timed one early). */
  closeAnswers: (token: string, sessionId: string) => apiPost(`/sessions/${sessionId}/close-answers`, {}, token),
  listAnswers: (token: string, sessionId: string, questionId?: string) =>
    apiGet<AnswerSummaryDto[]>(`/host/sessions/${sessionId}/answers${questionId ? `?questionId=${questionId}` : ''}`, token),
  listDisputes: (token: string, sessionId: string) => apiGet<AnswerSummaryDto[]>(`/sessions/${sessionId}/disputes`, token),
  resolveDispute: (token: string, answerId: string, decision: 'APPROVE' | 'REJECT') =>
    apiPost(`/answers/${answerId}/resolve-dispute`, { decision }, token),
  listInfractions: (token: string, sessionId: string) => apiGet<Infraction[]>(`/sessions/${sessionId}/infractions`, token),
  dismissInfraction: (token: string, sessionId: string, infractionId: string) =>
    apiPatch(`/sessions/${sessionId}/infractions/${infractionId}/review`, {}, token),
  addPaperScore: (token: string, sessionId: string, teamId: string, points: number, reason: string) =>
    apiPost(`/sessions/${sessionId}/teams/${teamId}/paper-score`, { points, reason: reason.trim() || undefined }, token),
};

const MEDIA_LIMITS: Record<string, number> = {
  'image/jpeg': 10,
  'image/png': 10,
  'image/webp': 10,
  'video/mp4': 50,
  'video/webm': 50,
  'audio/mpeg': 25,
  'audio/mp4': 25,
  'audio/ogg': 25,
  'audio/wav': 25,
};

export const ACCEPTED_MEDIA = [...Object.keys(MEDIA_LIMITS), '.m4a', '.wav', '.mp3'].join(',');

export function isAcceptedMedia(file: File): boolean {
  const limitMb = MEDIA_LIMITS[uploadMimeType(file)];
  return limitMb !== undefined && file.size > 0 && file.size <= limitMb * 1024 * 1024;
}

/** Uploads straight to Supabase storage through a signed URL issued by the API. */
export async function uploadQuestionMedia(token: string, quizId: string, file: File): Promise<MediaRefDto> {
  const upload = await apiPost<{ path: string; token: string; mediaType: 'image' | 'video' | 'audio' }>(
    `/quizzes/${quizId}/questions/media/upload-url`,
    { mimeType: uploadMimeType(file), fileSize: file.size },
    token,
  );
  const { error } = await supabase.storage
    .from('question-media')
    .uploadToSignedUrl(upload.path, upload.token, file, { contentType: uploadMimeType(file) });
  if (error) throw error;
  return { kind: upload.mediaType, source: 'upload', path: upload.path };
}

/** Linked media (direct links, YouTube) is copied; uploads stay with the original quiz's folder. */
const keepLinked = (ref: MediaRefDto | null) => (ref?.source === 'link' ? ref : null);

/**
 * Copies a quiz and its questions. Uploaded files are left out: the API only accepts uploads stored
 * under the new quiz's own folder, so they would have to be uploaded again.
 */
export async function duplicateQuiz(token: string, source: Quiz, title: string): Promise<Quiz> {
  const [copy, questions] = await Promise.all([
    hostApi.createQuiz(token, title, source.category_id, source.pub_id),
    hostApi.listQuestions(token, source.id),
  ]);
  for (const question of [...questions].sort((a, b) => a.order_index - b.order_index)) {
    await hostApi.createQuestion(token, copy.id, {
      ...stripIds(question),
      media: keepLinked(question.media),
      reveal_media: keepLinked(question.reveal_media),
    });
  }
  return copy;
}

/** Writes 0..n-1 as the order of the given questions, touching only those that moved. */
export async function saveQuestionOrder(token: string, quizId: string, ordered: Question[]): Promise<Question[]> {
  return Promise.all(
    ordered.map((question, index) =>
      question.order_index === index
        ? question
        : hostApi.updateQuestion(token, quizId, question.id, { ...stripIds(question), order_index: index }),
    ),
  );
}
