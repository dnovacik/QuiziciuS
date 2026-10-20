import { useState } from 'react';
import { DisputeQueue } from './DisputeQueue';
import { PaperModeGrid } from './PaperModeGrid';
import { SessionControlPanel } from './SessionControlPanel';

type Tab = 'controls' | 'disputes' | 'paper';
const TABS: Tab[] = ['controls', 'disputes', 'paper'];

export function SessionView({ sessionId, token }: { sessionId: string; token: string }) {
  const [tab, setTab] = useState<Tab>('controls');

  return (
    <div>
      <nav className="mx-auto flex max-w-2xl gap-2 px-6 pt-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1 text-sm ${tab === t ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === 'controls' && <SessionControlPanel sessionId={sessionId} token={token} />}
      {tab === 'disputes' && <DisputeQueue sessionId={sessionId} token={token} />}
      {tab === 'paper' && <PaperModeGrid sessionId={sessionId} token={token} />}
    </div>
  );
}
