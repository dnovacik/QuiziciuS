import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadSeat, type TeamSeat } from '../lib/team-seat';
import { useQuizTitle } from '../lib/use-quiz-title';
import { useSessionState } from '../lib/use-session-state';
import { JoinScreen } from './JoinScreen';
import { QuestionScreen } from './QuestionScreen';
import { ResultsScreen, RevealScreen } from './ResultScreens';
import { useGradedAnswers, useSubmittedAnswers } from './submitted-answers';
import { useQuizSecurity } from './use-quiz-security';
import { LobbyScreen, LockInScreen, PauseScreen } from './WaitingScreens';

export default function PlayApp() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const [seat, setSeat] = useState<TeamSeat | null>(() => loadSeat(sessionId));

  return (
    <div data-testid="play-app">
      {seat ? <Game key={seat.sessionId} seat={seat} /> : <JoinScreen sessionId={sessionId} onJoined={setSeat} />}
    </div>
  );
}

// The API keeps an open question's results hidden for this long after its timer ends.
const RESULTS_GRACE_MS = 2500;

function Game({ seat }: { seat: TeamSeat }) {
  const navigate = useNavigate();
  const { state, error, refetch } = useSessionState(seat.sessionId);
  const title = useQuizTitle(seat.sessionId);
  const { answers, record } = useSubmittedAnswers(seat.sessionId);
  const { requestFullscreenNow } = useQuizSecurity(state?.status ?? 'LOBBY', seat.token);
  const resultsPublic = state && ['QUESTION_REVEAL', 'PAUSE_BREAK', 'FINISHED'].includes(state.status);
  const graded = useGradedAnswers(seat.sessionId, seat.token, resultsPublic ? `${state.status}:${state.currentQuestion?.id}` : null);

  // Scores of the open question become public once its timer runs out; nothing is broadcast
  // at that moment, so fetch the state once ourselves.
  const endsAt = state?.status === 'QUESTION_ACTIVE' ? state.questionEndsAt : null;
  useEffect(() => {
    if (!endsAt) return;
    const timer = setTimeout(refetch, Math.max(0, Date.parse(endsAt) + RESULTS_GRACE_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [endsAt, refetch]);

  if (!state) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-surface-container-lowest p-6 text-center text-on-surface-variant" aria-busy={!error}>
        {error ?? <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
      </div>
    );
  }

  const question = state.currentQuestion;
  switch (state.status) {
    case 'LOBBY':
      return <LobbyScreen state={state} teamId={seat.teamId} title={title} />;
    case 'LOCK_IN_ROUND':
      return <LockInScreen state={state} onReady={requestFullscreenNow} />;
    case 'PAUSE_BREAK':
      return <PauseScreen state={state} teamId={seat.teamId} />;
    case 'FINISHED':
      return <ResultsScreen state={state} teamId={seat.teamId} title={title} onExit={() => navigate('/')} />;
    case 'QUESTION_REVEAL':
      return question ? (
        <RevealScreen state={state} question={question} teamId={seat.teamId} sent={answers[question.id]} graded={graded[question.id]} />
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
          submitted={answers[question.id]}
          onSubmitted={(answer) => record(question.id, answer)}
        />
      ) : (
        <LobbyScreen state={state} teamId={seat.teamId} title={title} />
      );
  }
}
