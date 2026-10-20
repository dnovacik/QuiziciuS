import { useEffect, useState } from 'react';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CountdownRing({ endsAt, totalSeconds }: { endsAt: string; totalSeconds: number }) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(endsAt).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(new Date(endsAt).getTime() - Date.now());
    }, 250);
    return () => clearInterval(interval);
  }, [endsAt]);

  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingMs / (totalSeconds * 1000))) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - fraction);

  return (
    <svg
      width={140}
      height={140}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`${remainingSeconds} seconds remaining`}
    >
      <circle cx={60} cy={60} r={RADIUS} fill="none" stroke="#1e293b" strokeWidth={8} />
      <circle
        cx={60}
        cy={60}
        r={RADIUS}
        fill="none"
        stroke="#facc15"
        strokeWidth={8}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
      />
      <text x={60} y={68} textAnchor="middle" fontSize={28} fill="white">
        {remainingSeconds}
      </text>
    </svg>
  );
}
