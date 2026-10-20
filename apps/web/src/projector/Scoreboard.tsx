import { TeamSummaryDto } from '@quizicius/shared-types';

export function Scoreboard({ teams }: { teams: TeamSummaryDto[] }) {
  const ranked = [...teams].sort((a, b) => b.score - a.score);

  return (
    <ol className="mx-auto mt-8 max-w-xl space-y-2" data-testid="scoreboard">
      {ranked.map((team, index) => (
        <li key={team.id} className="flex items-center justify-between rounded bg-slate-900 px-6 py-3 text-2xl">
          <span>
            #{index + 1} {team.name}
          </span>
          <span className="font-bold text-yellow-400">{team.score}</span>
        </li>
      ))}
    </ol>
  );
}
