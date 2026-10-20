import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <h1 className="text-4xl font-bold">Quizicius</h1>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link to="/host" className="rounded bg-slate-900 px-8 py-4 text-lg text-white">
          I&apos;m hosting
        </Link>
        <Link to="/play" className="rounded bg-emerald-600 px-8 py-4 text-lg text-white">
          Join a quiz
        </Link>
      </div>
    </div>
  );
}
