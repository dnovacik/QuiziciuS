import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadSeat, type TeamSeat } from '../lib/team-seat';
import { apiPost } from '../lib/api-client';
import { useSessionDisplay } from '../lib/use-quiz-title';
import { usePreloadQuestionMedia } from '../lib/use-current-question-media';
import { useSessionState } from '../lib/use-session-state';
import { JoinScreen } from './JoinScreen';
import { QuestionScreen } from './QuestionScreen';
import { ResultsScreen, RevealScreen } from './ResultScreens';
import { describeResponse, useGradedAnswers, useSubmittedAnswers } from './submitted-answers';
import { useQuizSecurity } from './use-quiz-security';
import { LobbyScreen, LockInScreen, PauseScreen } from './WaitingScreens';

export default function PlayApp() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const [seat, setSeat] = useState<TeamSeat | null>(() => loadSeat(sessionId));

  function joined(next: TeamSeat) {
    setSeat(next);
    // The seat is stored per session: a phone that reloads the tab (mobile browsers discard
    // backgrounded tabs) finds it again only when the session is in the address.
    if (sessionId !== next.sessionId) navigate(`/play/${next.sessionId}`, { replace: true });
  }

  return (
    <div data-testid="play-app">
      {seat ? <Game key={seat.sessionId} seat={seat} /> : <JoinScreen sessionId={sessionId} onJoined={joined} />}
    </div>
  );
}

// The API keeps an open question's results hidden for this long after its timer ends.
const RESULTS_GRACE_MS = 2500;

function Game({ seat }: { seat: TeamSeat }) {
  const navigate = useNavigate();
  const { state, error, refetch } = useSessionState(seat.sessionId);
  usePreloadQuestionMedia(seat.sessionId, state?.currentQuestion?.id, state?.status);
  const display = useSessionDisplay(seat.sessionId);
  const title = display.title;
  const { answers, record } = useSubmittedAnswers(seat.sessionId);
  const { requestFullscreenNow } = useQuizSecurity(state?.status ?? 'LOBBY', seat.token);
  // The API returns this team's submission even before grading becomes public.
  // State changes and score updates recover answers submitted before the phone went offline. The
  // points are withheld while scores are hidden, so publishing them must reload the answers too.
  const graded = useGradedAnswers(
    seat.sessionId,
    seat.token,
    state ? `${state.status}:${state.currentQuestion?.id}:${state.scoresVisible ? 'scores' : 'hidden'}` : null,
  );
  const serverAnswer = state?.currentQuestion ? graded[state.currentQuestion.id] : undefined;
  const recoveredAnswer =
    state?.currentQuestion && serverAnswer
      ? { ...describeResponse(state.currentQuestion, serverAnswer.response), submittedAt: 0 }
      : undefined;

  // Scores of the open question become public once its timer runs out; nothing is broadcast
  // at that moment, so fetch the state once ourselves.
  const endsAt = state?.status === 'QUESTION_ACTIVE' && !state.questionPausedAt ? state.questionEndsAt : null;
  useEffect(() => {
    if (!endsAt) return;
    const timer = setTimeout(refetch, Math.max(0, Date.parse(endsAt) + RESULTS_GRACE_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [endsAt, refetch]);

  if (!state) {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center bg-surface-container-lowest p-6 text-center text-on-surface-variant"
        aria-busy={!error}
      >
        {error ?? <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
      </div>
    );
  }

  const question = state.currentQuestion;
  switch (state.status) {
    case 'LOBBY':
      return <LobbyScreen state={state} teamId={seat.teamId} title={title} league={display.league} seat={seat} />;
    case 'LOCK_IN_ROUND':
      return (
        <LockInScreen
          state={state}
          teamId={seat.teamId}
          onReady={async () => {
            // A team whose browser refuses fullscreen still counts as ready; the host sees a warning.
            const fullscreen = await requestFullscreenNow();
            await apiPost(`/sessions/${seat.sessionId}/teams/me/ready`, { fullscreen }, seat.token);
          }}
        />
      );
    case 'PAUSE_BREAK':
      return <PauseScreen state={state} teamId={seat.teamId} />;
    case 'FINISHED':
      return <ResultsScreen state={state} teamId={seat.teamId} title={title} pub={display.pub} onExit={() => navigate('/')} />;
    case 'QUESTION_REVEAL':
      return question ? (
        <RevealScreen
          state={state}
          question={question}
          teamId={seat.teamId}
          token={seat.token}
          sent={recoveredAnswer ?? answers[question.id]}
          graded={graded[question.id]}
        />
      ) : (
        <LobbyScreen state={state} teamId={seat.teamId} title={title} />
      );
    case 'QUESTION_ACTIVE':
      return question ? (
        <QuestionScreen
          key={question.id}
          state={state}
          question={question}
          seat={seat}
          submitted={recoveredAnswer ?? answers[question.id]}
          onSubmitted={(answer) => record(question.id, answer)}
        />
      ) : (
        <LobbyScreen state={state} teamId={seat.teamId} title={title} />
      );
  }
}
