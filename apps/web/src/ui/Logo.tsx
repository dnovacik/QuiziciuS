import { Link } from 'react-router-dom';

const SIZES = {
  sm: { tile: 'h-8 w-8 rounded-lg', inner: 'rounded-[7px]', bulb: 'h-4 w-4', text: 'text-lg' },
  md: { tile: 'h-10 w-10 rounded-xl', inner: 'rounded-[10px]', bulb: 'h-5 w-5', text: 'text-2xl' },
  lg: { tile: 'h-14 w-14 rounded-2xl', inner: 'rounded-[14px]', bulb: 'h-7 w-7', text: 'text-4xl' },
} as const;

type LogoSize = keyof typeof SIZES;

/** Bulb glyph from the Stitch landing header — the one brand mark used everywhere. */
function Bulb({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C7.58 2 4 5.58 4 10c0 2.65 1.3 4.99 3.3 6.42.3.21.7.67.7 1.08v.5c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-.5c0-.41.4-.87.7-1.08 2-1.43 3.3-3.77 3.3-6.42 0-4.42-3.58-8-8-8zm-2 18h4v1c0 .55-.45 1-1 1h-2c-.55 0-1-.45-1-1v-1z" />
    </svg>
  );
}

export function LogoMark({ size = 'md' }: { size?: LogoSize }) {
  const s = SIZES[size];
  return (
    <span
      className={`${s.tile} block shrink-0 bg-gradient-to-tr from-amber-500 via-purple-600 to-indigo-600 p-[1.5px] shadow-lg shadow-purple-900/30`}
    >
      <span className={`${s.inner} flex h-full w-full items-center justify-center bg-dark-900`}>
        <Bulb className={`${s.bulb} text-amber-400 transition-transform group-hover:scale-110`} />
      </span>
    </span>
  );
}

export function Logo({ size = 'md', to }: { size?: LogoSize; to?: string }) {
  const content = (
    <>
      <LogoMark size={size} />
      {/* 800 is the heaviest loaded weight; font-black would make the browser fake a bolder face. */}
      <span className={`${SIZES[size].text} font-extrabold tracking-tight text-white`}>
        Quiziciu<span className="text-brand-glow">s</span>
      </span>
    </>
  );
  const className = 'group flex items-center gap-2';

  if (to === undefined) {
    return (
      <span className={className} aria-label="QuiziciuS">
        {content}
      </span>
    );
  }
  return (
    <Link to={to} className={`${className} focus:outline-none`} aria-label="QuiziciuS" data-testid="logo">
      {content}
    </Link>
  );
}
