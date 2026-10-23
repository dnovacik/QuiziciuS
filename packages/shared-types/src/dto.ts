import { AccountRole, GradedBy, QuestionType, QuizState } from './enums';

export interface QuestionOptionDto {
  id: string;
  label: string;
}

export interface QuestionPublicDto {
  id: string;
  type: QuestionType;
  prompt: string;
  options: QuestionOptionDto[] | null;
  points: number;
  timeLimitSeconds: number;
  orderIndex: number;
  // Populated only once the session has reached QUESTION_REVEAL or later — null beforehand so
  // /play and /projector clients can never read the answer before it's meant to be shown.
  correctOptionId: string | null;
  correctNumeric: number | null;
  acceptedAnswers: string[] | null;
}

export interface TeamSummaryDto {
  id: string;
  name: string;
  isActive: boolean;
  /** The registered team this session team was joined as, or null for a one-off team. */
  registeredTeamId: string | null;
  /** Tapped "we're ready" for the question that is locked in right now (false outside LOCK_IN_ROUND). */
  ready: boolean;
  /** Ready and the browser entered fullscreen; ready without it means the fullscreen check is off. */
  readyFullscreen: boolean;
  score: number;
  infractionCount: number;
}

export interface QuizSessionStateDto {
  id: string;
  joinCode: string;
  status: QuizState;
  currentQuestion: QuestionPublicDto | null;
  questionEndsAt: string | null;
  teams: TeamSummaryDto[];
}

export interface AnswerSummaryDto {
  id: string;
  sessionId: string;
  questionId: string;
  teamId: string;
  response: unknown;
  isCorrect: boolean | null;
  confidence: number | null;
  needsReview: boolean;
  gradedBy: GradedBy | null;
  scoreAwarded: number;
}

/** The signed-in account as the web app sees it (GET /me). */
export interface AccountDto {
  id: string;
  email: string | null;
  displayName: string;
  role: AccountRole;
  /** A deactivated host can sign in and edit quizzes but cannot launch quiz nights. */
  deactivated: boolean;
}
