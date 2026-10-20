import { FormEvent, useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api-client';

interface QuizSummary {
  id: string;
  title: string;
}

interface QuestionFormProps {
  quizId: string;
  token: string;
  onCreated: () => void;
}

function QuestionForm({ quizId, token, onCreated }: QuestionFormProps) {
  const [prompt, setPrompt] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [correct, setCorrect] = useState<'a' | 'b'>('a');
  const [points, setPoints] = useState(1);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await apiPost(
        `/quizzes/${quizId}/questions`,
        {
          type: 'MULTIPLE_CHOICE',
          prompt,
          options: [
            { id: 'a', label: optionA, isCorrect: correct === 'a' },
            { id: 'b', label: optionB, isCorrect: correct === 'b' },
          ],
          points,
          orderIndex: 0,
        },
        token,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add question');
      return;
    }
    setPrompt('');
    setOptionA('');
    setOptionB('');
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 rounded border border-dashed p-3">
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Question prompt"
        className="w-full rounded border px-2 py-1"
        required
      />
      <div className="flex gap-2">
        <input
          value={optionA}
          onChange={(e) => setOptionA(e.target.value)}
          placeholder="Option A"
          className="flex-1 rounded border px-2 py-1"
          required
        />
        <input
          value={optionB}
          onChange={(e) => setOptionB(e.target.value)}
          placeholder="Option B"
          className="flex-1 rounded border px-2 py-1"
          required
        />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <label>
          <input type="radio" checked={correct === 'a'} onChange={() => setCorrect('a')} /> A is correct
        </label>
        <label>
          <input type="radio" checked={correct === 'b'} onChange={() => setCorrect('b')} /> B is correct
        </label>
        <input
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          className="w-16 rounded border px-2 py-1"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="rounded bg-slate-700 px-3 py-1 text-sm text-white">
        Add question
      </button>
    </form>
  );
}

export function QuizDashboard({
  token,
  onSessionCreated,
}: {
  token: string;
  onSessionCreated: (sessionId: string, quizId: string) => void;
}) {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [title, setTitle] = useState('');
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<QuizSummary[]>('/quizzes', token)
      .then((rows) => {
        if (!cancelled) setQuizzes(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load quizzes');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleCreateQuiz(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!title.trim()) return;
    setError(null);
    try {
      const quiz = await apiPost<QuizSummary>('/quizzes', { title }, token);
      setQuizzes((prev) => [...prev, quiz]);
      setTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quiz');
    }
  }

  async function handleCreateSession(quizId: string): Promise<void> {
    setError(null);
    try {
      const session = await apiPost<{ id: string; join_code: string }>(`/quizzes/${quizId}/sessions`, {}, token);
      onSessionCreated(session.id, quizId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-4 text-xl font-semibold">Your quizzes</h2>
      <form onSubmit={handleCreateQuiz} className="mb-6 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New quiz title"
          className="flex-1 rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          Create quiz
        </button>
      </form>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <ul className="space-y-4">
        {quizzes.map((quiz) => (
          <li key={quiz.id} className="rounded border p-3">
            <div className="flex items-center justify-between">
              <span>
                <span>{quiz.title}</span> ({questionCounts[quiz.id] ?? 0} questions added)
              </span>
              <button
                onClick={() => handleCreateSession(quiz.id)}
                className="rounded bg-emerald-600 px-3 py-1 text-sm text-white"
              >
                Start session
              </button>
            </div>
            <QuestionForm
              quizId={quiz.id}
              token={token}
              onCreated={() => setQuestionCounts((prev) => ({ ...prev, [quiz.id]: (prev[quiz.id] ?? 0) + 1 }))}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
