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
  /** Numeric questions: the unit the answer is in, shown next to the input and the result. */
  unit: string | null;
}

export interface TeamSummaryDto {
  id: string;
  name: string;
  isActive: boolean;
  /** The registered team this session team was joined as, or null for a one-off team. */
  registeredTeamId: string | null;
  /** The table the team said it sits at, if any. */
  tableNumber: string | null;
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
  /** Set while the host has paused the timer: the countdown stands still at `questionEndsAt - questionPausedAt`. */
  questionPausedAt: string | null;
  /** Teams that have answered the current question; null outside a question. */
  answeredCount: number | null;
  /** Questions shown so far, in order (ids only), so every host device agrees what comes next. */
  playedQuestionIds: string[];
  /** During a break: when it is planned to end and the host's message, if any. */
  breakEndsAt: string | null;
  breakMessage: string | null;
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
  /** The team disputed this grade (it can only once); the note is its reason for the host. */
  disputed: boolean;
  disputeNote: string | null;
}

/** The signed-in account as the web app sees it (GET /me). */
export interface AccountDto {
  id: string;
  email: string | null;
  displayName: string;
  role: AccountRole;
  /** A deactivated host can sign in and edit quizzes but cannot launch quiz nights. */
  deactivated: boolean;
  /** Null for team captains, who need no subscription. */
  subscription: SubscriptionDto | null;
}

/** Days of the automatic trial a new host gets. */
export const TRIAL_DAYS = 14;
/** Hosts are reminded this many days before their subscription ends. */
export const SUBSCRIPTION_WARNING_DAYS = 7;

export const SUBSCRIPTION_STATUSES = ['FOREVER', 'TRIAL', 'ACTIVE', 'EXPIRED'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** A host's subscription. Only FOREVER, TRIAL and ACTIVE may launch quiz nights. */
export interface SubscriptionDto {
  status: SubscriptionStatus;
  /** Last day (inclusive, `YYYY-MM-DD`, Slovak time) the host may launch quiz nights; null when never set. */
  until: string | null;
  /** Whether the forever flag is set (super admins are FOREVER without it). */
  forever: boolean;
}

/** League points for 1st, 2nd, … 8th place on a league night; lower places get 0. */
export const LEAGUE_PLACE_POINTS = [10, 8, 6, 5, 4, 3, 2, 1] as const;

export type LeagueKind = 'LEAGUE' | 'SUPER';
export type LeaguePhase = 'PREPARING' | 'RUNNING' | 'CLOSED';
export type LeagueHostStatus = 'INVITED' | 'ACCEPTED' | 'DECLINED';
export type LeagueTeamStatus = 'INVITED' | 'JOINED' | 'DECLINED';

export interface LeaguePubDto {
  id: string;
  name: string;
  city: string;
  hostId: string;
}

export interface LeagueStandingDto {
  rank: number;
  registeredTeamId: string;
  teamName: string;
  /** The pub the team represents (qualification); null when it never got one. */
  pubId: string | null;
  points: number;
  nights: number;
  /** Place per night played, in night order. */
  placements: number[];
}

export interface LeagueSummaryDto {
  id: string;
  name: string;
  kind: LeagueKind;
  phase: LeaguePhase;
  startsOn: string;
  endsOn: string | null;
  message: string | null;
  ownerHostId: string;
  ownerName: string;
  pubs: LeaguePubDto[];
  nightsPlayed: number;
  joinedTeams: number;
  parentLeagueId: string | null;
}

export interface HostLeagueDto extends LeagueSummaryDto {
  myStatus: LeagueHostStatus;
  isOwner: boolean;
}

export interface LeagueDetailDto extends HostLeagueDto {
  hosts: { id: string; name: string; status: LeagueHostStatus }[];
  teams: { registeredTeamId: string; name: string; status: LeagueTeamStatus; pubId: string | null }[];
  standings: LeagueStandingDto[];
  /** Top 3 per pub of a closed LEAGUE; empty otherwise. */
  qualified: LeagueStandingDto[];
  superLeagueId: string | null;
  /** The owner should close the league: its end date has passed. */
  endedAwaitingClose: boolean;
}

export interface TeamLeagueDto {
  league: LeagueSummaryDto;
  status: LeagueTeamStatus;
  standings: LeagueStandingDto[];
}

export interface InvitableHostDto {
  id: string;
  name: string;
  pubs: { id: string; name: string; city: string }[];
}

export type MediaKind = 'image' | 'video' | 'audio' | 'youtube';
export type MediaSlot = 'question' | 'reveal';
export type MediaAction = 'play' | 'pause' | 'replay';
export type MediaPlaybackState = 'playing' | 'paused' | 'ended' | 'error' | 'blocked';

/** A question's media as stored: an upload (`path`) or a link (`url`), with an optional part to play. */
export interface MediaRefDto {
  kind: MediaKind;
  /** YouTube is always a link. */
  source: 'upload' | 'link';
  path?: string;
  url?: string;
  startSeconds?: number;
  durationSeconds?: number;
}

/** Media ready to show during a night: uploads already have a (signed) URL. */
export interface ResolvedMediaDto {
  kind: MediaKind;
  url: string;
  startSeconds: number | null;
  durationSeconds: number | null;
}
