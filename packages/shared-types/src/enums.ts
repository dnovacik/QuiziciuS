export const QUIZ_STATES = ['LOBBY', 'LOCK_IN_ROUND', 'QUESTION_ACTIVE', 'QUESTION_REVEAL', 'PAUSE_BREAK', 'FINISHED'] as const;
export type QuizState = (typeof QUIZ_STATES)[number];

export const QUESTION_TYPES = ['MULTIPLE_CHOICE', 'FREE_TEXT', 'NUMERIC_NEAREST'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const INFRACTION_TYPES = ['VISIBILITY_HIDDEN', 'FULLSCREEN_EXIT', 'WAKE_LOCK_LOST'] as const;
export type InfractionType = (typeof INFRACTION_TYPES)[number];

export const GRADED_BY = ['AUTO', 'HOST'] as const;
export type GradedBy = (typeof GRADED_BY)[number];
