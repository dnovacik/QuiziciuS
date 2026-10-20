import { QuizSessionStateDto } from '@quizicius/shared-types';
import { FormEvent, useState } from 'react';
import { apiPost } from '../lib/api-client';

export function QuestionScreen({
  state,
  teamId,
  token,
  onTapToLockIn,
}: {
  state: QuizSessionStateDto;
  teamId: string;
  token: string;
  onTapToLockIn: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [text, setText] = useState('');
  const [numericValue, setNumericValue] = useState('');
  void teamId; // the team is identified server-side by the bearer token, not this prop

  async function submit(response: Record<string, unknown>): Promise<void> {
    if (!state.currentQuestion) return;
    await apiPost(`/sessions/${state.id}/answers`, { questionId: state.currentQuestion.id, response }, token);
    setSubmitted(true);
  }

  if (state.status === 'LOBBY') {
    return (
      <div className="flex min-h-screen items-center justify-center text-xl">Waiting for the quiz to start…</div>
    );
  }

  if (state.status === 'LOCK_IN_ROUND') {
    return (
      <button
        onClick={onTapToLockIn}
        className="flex min-h-screen w-full items-center justify-center bg-slate-900 text-3xl font-bold text-white"
      >
        Tap to Lock In
      </button>
    );
  }

  if (state.status === 'QUESTION_ACTIVE' && state.currentQuestion) {
    if (submitted) {
      return <div className="flex min-h-screen items-center justify-center text-xl">Answer locked in!</div>;
    }

    const question = state.currentQuestion;

    if (question.type === 'MULTIPLE_CHOICE') {
      return (
        <div className="mx-auto max-w-md p-6">
          <h1 className="mb-6 text-2xl font-bold">{question.prompt}</h1>
          <div className="flex flex-col gap-3">
            {question.options?.map((option) => (
              <button
                key={option.id}
                onClick={() => submit({ optionId: option.id })}
                className="rounded border-2 border-slate-900 px-4 py-3 text-left text-lg"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (question.type === 'FREE_TEXT') {
      return (
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            submit({ text });
          }}
          className="mx-auto max-w-md p-6"
        >
          <h1 className="mb-6 text-2xl font-bold">{question.prompt}</h1>
          <input value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded border px-3 py-2" />
          <button type="submit" className="mt-4 w-full rounded bg-slate-900 px-4 py-3 text-white">
            Submit
          </button>
        </form>
      );
    }

    return (
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          submit({ value: Number(numericValue) });
        }}
        className="mx-auto max-w-md p-6"
      >
        <h1 className="mb-6 text-2xl font-bold">{question.prompt}</h1>
        <input
          type="number"
          value={numericValue}
          onChange={(e) => setNumericValue(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
        <button type="submit" className="mt-4 w-full rounded bg-slate-900 px-4 py-3 text-white">
          Submit
        </button>
      </form>
    );
  }

  if (state.status === 'QUESTION_REVEAL' && state.currentQuestion) {
    const correctOption = state.currentQuestion.options?.find(
      (option) => option.id === state.currentQuestion?.correctOptionId,
    );
    const answerText =
      correctOption?.label ??
      state.currentQuestion.correctNumeric ??
      state.currentQuestion.acceptedAnswers?.[0] ??
      '';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-2xl font-bold">{state.currentQuestion.prompt}</h1>
        <p className="text-xl text-emerald-600">Correct answer: {answerText}</p>
      </div>
    );
  }

  return <div className="flex min-h-screen items-center justify-center text-xl">Standby…</div>;
}
