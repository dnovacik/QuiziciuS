import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnswerSummaryDto, MediaAction, MediaPlaybackState, MediaRefDto, MediaSlot, QuizState } from '@quizicius/shared-types';
import { ApiError } from '../../lib/api-client';
import { describeError } from '../../lib/errors';
import { useI18n } from '../../lib/i18n';
import { subscribeToMediaStatus } from '../../lib/media-channel';
import { useSessionState } from '../../lib/use-session-state';
import { hostApi, type BreakOptions, type HostSession, type Question, type Quiz } from '../api';

/** Questions already played, kept per browser so a reload does not forget them. */
function usePlayedQuestions(sessionId: string) {
  const key = `quizicius:played:${sessionId}`;
  const [played, setPlayed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
    } catch {
      return [];
    }
  });
  const markPlayed = useCallback(
    (questionId: string) =>
      setPlayed((list) => {
        if (list.includes(questionId)) return list;
        const next = [...list, questionId];
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Best effort only.
        }
        return next;
      }),
    [key],
  );
  return { played, markPlayed };
}

const BREAK_KEY = 'quizicius:break-options';

/** The last break setup, kept per browser so the same message carries over to the next night. */
function useBreakOptions() {
  const [options, setOptions] = useState<BreakOptions>(() => {
    try {
      return { minutes: 0, message: '', ...(JSON.parse(localStorage.getItem(BREAK_KEY) ?? '{}') as Partial<BreakOptions>) };
    } catch {
      return { minutes: 0, message: '' };
    }
  });
  const update = useCallback((patch: Partial<BreakOptions>) => {
    setOptions((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(BREAK_KEY, JSON.stringify(next));
      } catch {
        // Best effort only.
      }
      return next;
    });
  }, []);
  return [options, update] as const;
}

/** Everything the live control room needs: session, quiz, questions, answers and transitions. */
export function useControlRoom(token: string, sessionId: string) {
  const { t } = useI18n();
  const { state, error: stateError, refetch } = useSessionState(sessionId);
  const [session, setSession] = useState<HostSession | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerSummaryDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { played, markPlayed } = usePlayedQuestions(sessionId);
  const [breakOptions, setBreakOptions] = useBreakOptions();

  useEffect(() => {
    let active = true;
    hostApi
      .getSession(token, sessionId)
      .then(async (row) => {
        if (!active) return;
        setSession(row);
        const [quizRows, questionRows] = await Promise.all([hostApi.listQuizzes(token), hostApi.listQuestions(token, row.quiz_id)]);
        if (!active) return;
        setQuiz(quizRows.find((item) => item.id === row.quiz_id) ?? null);
        setQuestions([...questionRows].sort((a, b) => a.order_index - b.order_index));
      })
      .catch((err) => active && setError(describeError(err, t, 'errors.generic')));
    return () => {
      active = false;
    };
  }, [token, sessionId, t]);

  // Realtime keeps the state fresh; a slow poll covers a dropped websocket.
  useEffect(() => {
    const timer = setInterval(refetch, 15000);
    return () => clearInterval(timer);
  }, [refetch]);

  const currentId = state?.currentQuestion?.id ?? null;
  const status = state?.status;

  useEffect(() => {
    if (currentId && status && status !== 'LOBBY' && status !== 'LOCK_IN_ROUND') markPlayed(currentId);
  }, [currentId, status, markPlayed]);

  // Answers to the question on screen; refreshed on every state change and while answering is open.
  const refreshAnswers = useCallback(() => {
    if (!currentId) {
      setAnswers([]);
      return;
    }
    hostApi
      .listAnswers(token, sessionId, currentId)
      .then(setAnswers)
      .catch(() => {
        // Keep the last known answers; the next state change retries.
      });
  }, [token, sessionId, currentId]);
  useEffect(refreshAnswers, [refreshAnswers, state]);

  // Answers waiting for the host (unsure grading or a team's dispute), counted on every state change.
  const [pendingReviews, setPendingReviews] = useState(0);
  useEffect(() => {
    if (!state) return;
    let active = true;
    hostApi
      .listDisputes(token, sessionId)
      .then((rows) => active && setPendingReviews(rows.length))
      .catch(() => {
        // Keep the last count.
      });
    return () => {
      active = false;
    };
  }, [token, sessionId, state]);
  useEffect(() => {
    if (status !== 'QUESTION_ACTIVE') return;
    const timer = setInterval(refreshAnswers, 3000);
    return () => clearInterval(timer);
  }, [status, refreshAnswers]);

  const nextUnplayed = useMemo(() => {
    const from = questions.findIndex((question) => question.id === currentId);
    const rotated = [...questions.slice(from + 1), ...questions.slice(0, Math.max(from, 0))];
    return rotated.find((question) => question.id !== currentId && !played.includes(question.id)) ?? null;
  }, [questions, currentId, played]);

  // Preselect the next question once per closed round, and the first one in the lobby.
  const advancedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!questions.length) return;
    if (status === 'LOBBY' && !selectedId) {
      setSelectedId(nextUnplayed?.id ?? questions[0].id);
      return;
    }
    const closed = status === 'QUESTION_REVEAL' || status === 'PAUSE_BREAK';
    if (closed && currentId && advancedFor.current !== currentId) {
      advancedFor.current = currentId;
      setSelectedId(nextUnplayed?.id ?? null);
    }
  }, [status, currentId, questions, nextUnplayed, selectedId]);

  /** Runs one host action at a time; true when it went through, false when busy or refused. */
  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      if (busy) return false;
      setBusy(true);
      setError(null);
      try {
        await action();
        refetch();
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) refetch();
        setError(describeError(err, t, 'errors.generic'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, refetch, t],
  );

  const transition = useCallback(
    async (next: QuizState): Promise<boolean> => {
      if (next === 'LOCK_IN_ROUND' && !selectedId) return false;
      return run(() =>
        hostApi.transition(
          token,
          sessionId,
          next,
          next === 'LOCK_IN_ROUND' ? (selectedId ?? undefined) : undefined,
          next === 'PAUSE_BREAK' ? breakOptions : undefined,
        ),
      );
    },
    [run, selectedId, breakOptions, token, sessionId],
  );

  const controlTimer = useCallback(
    (action: 'pause' | 'resume' | 'extend') => run(() => hostApi.timer(token, sessionId, action)),
    [run, token, sessionId],
  );

  const closeAnswers = useCallback(() => run(() => hostApi.closeAnswers(token, sessionId)), [run, token, sessionId]);

  const currentQuestion = questions.find((question) => question.id === currentId) ?? null;
  /** A displayable URL for an image: links as they are, uploads through a signed link. */
  const mediaUrl = useCallback(
    async (question: Question, ref: MediaRefDto) =>
      ref.source === 'link' ? (ref.url ?? '') : hostApi.mediaUrl(token, question.quiz_id, ref.path ?? ''),
    [token],
  );

  // What the projector reports it is doing with each clip, per question and slot.
  const [mediaStatus, setMediaStatus] = useState<Record<string, { state: MediaPlaybackState; at: number }>>({});
  useEffect(
    () =>
      subscribeToMediaStatus(sessionId, (message) =>
        setMediaStatus((current) => ({ ...current, [`${message.questionId}:${message.slot}`]: { state: message.state, at: Date.now() } })),
      ),
    [sessionId],
  );
  const mediaControl = useCallback(
    async (slot: MediaSlot, action: MediaAction): Promise<boolean> => {
      setError(null);
      try {
        await hostApi.mediaControl(token, sessionId, slot, action);
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) refetch();
        setError(describeError(err, t, 'errors.generic'));
        return false;
      }
    },
    [token, sessionId, refetch, t],
  );

  return {
    mediaUrl,
    mediaStatus,
    mediaControl,
    state,
    stateError,
    refetch,
    session,
    quiz,
    questions,
    currentQuestion,
    answers,
    refreshAnswers,
    played,
    selectedId,
    setSelectedId,
    nextUnplayed,
    transition,
    closeAnswers,
    controlTimer,
    pendingReviews,
    breakOptions,
    setBreakOptions,
    busy,
    error,
    setError,
  };
}

export type ControlRoom = ReturnType<typeof useControlRoom>;
