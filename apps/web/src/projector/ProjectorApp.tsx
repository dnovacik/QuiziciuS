import { useParams } from 'react-router-dom';
import { useSessionState } from '../lib/use-session-state';
import { CountdownRing } from './CountdownRing';
import { Scoreboard } from './Scoreboard';

export default function ProjectorApp() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { state } = useSessionState(sessionId);

  if (!state) {
    return (
      <div
        data-testid="projector-app"
        className="flex min-h-screen items-center justify-center bg-slate-950 text-2xl text-white"
      >
        Waiting for session…
      </div>
    );
  }

  const correctOption = state.currentQuestion?.options?.find(
    (option) => option.id === state.currentQuestion?.correctOptionId,
  );
  const correctAnswerText =
    correctOption?.label ??
    state.currentQuestion?.correctNumeric ??
    state.currentQuestion?.acceptedAnswers?.[0] ??
    '';

  return (
    <div data-testid="projector-app" className="min-h-screen bg-slate-950 p-8 text-white">
      <p className="text-sm uppercase tracking-widest text-slate-400">Join code: {state.joinCode}</p>

      {state.status === 'QUESTION_ACTIVE' && state.currentQuestion && state.questionEndsAt && (
        <div className="mt-8 flex flex-col items-center gap-6">
          <CountdownRing endsAt={state.questionEndsAt} totalSeconds={state.currentQuestion.timeLimitSeconds} />
          <h1 className="text-center text-5xl font-bold">{state.currentQuestion.prompt}</h1>
        </div>
      )}

      {state.status === 'QUESTION_REVEAL' && state.currentQuestion && (
        <div className="mt-8 text-center" data-testid="reveal-banner">
          <h1 className="text-5xl font-bold">{state.currentQuestion.prompt}</h1>
          <p className="mt-4 text-3xl text-emerald-400">Correct answer: {correctAnswerText}</p>
        </div>
      )}

      {(state.status === 'LOBBY' || state.status === 'PAUSE_BREAK' || state.status === 'FINISHED') && (
        <Scoreboard teams={state.teams} />
      )}
    </div>
  );
}
