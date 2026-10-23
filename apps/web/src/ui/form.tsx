import type { ComponentType, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import type { LucideProps } from 'lucide-react';

type Icon = ComponentType<LucideProps>;

/** Label row from the Stitch forms: small bold caption with an optional right-hand hint. */
export function FieldLabel({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-300">
        <span>{label}</span>
        {hint && <span className="text-[11px] font-medium text-slate-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function LeadingIcon({ icon: IconComponent }: { icon: Icon }) {
  return (
    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
      <IconComponent className="h-4 w-4" />
    </span>
  );
}

export function IconInput({
  icon,
  trailing,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { icon: Icon; trailing?: ReactNode }) {
  return (
    <span className="relative block">
      <LeadingIcon icon={icon} />
      <input className={`glass-input py-2.5 pl-10 ${trailing ? 'pr-10' : 'pr-4'} ${className}`} {...props} />
      {trailing && <span className="absolute inset-y-0 right-0 flex items-center pr-3.5">{trailing}</span>}
    </span>
  );
}

export function IconSelect({
  icon,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { icon: Icon; children: ReactNode }) {
  return (
    <span className="relative block">
      <LeadingIcon icon={icon} />
      <select className="glass-input cursor-pointer bg-dark-900 py-2.5 pl-10 pr-4" {...props}>
        {children}
      </select>
    </span>
  );
}

/** Two- or three-way tab switch used at the top of the auth card and the team dialog. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testIdPrefix,
}: {
  options: { value: T; label: ReactNode; icon?: Icon }[];
  value: T;
  onChange: (value: T) => void;
  testIdPrefix: string;
}) {
  const columns = options.length === 3 ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <div role="tablist" className={`grid ${columns} rounded-2xl border border-white/10 bg-dark-950/80 p-1`}>
      {options.map(({ value: option, label, icon: IconComponent }) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`${testIdPrefix}-${option}`}
            onClick={() => onChange(option)}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs transition-all sm:text-sm ${
              active ? 'bg-brand-600 font-bold text-white shadow-md' : 'font-semibold text-slate-400 hover:text-white'
            }`}
          >
            {IconComponent && <IconComponent className="h-4 w-4" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function FormNotice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  const styles =
    tone === 'error' ? 'border-red-500/40 bg-red-950/30 text-red-200' : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200';
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      data-testid="form-notice"
      className={`rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${styles}`}
    >
      {children}
    </p>
  );
}

export const primaryButtonClass =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-bold text-white shadow-neon-glow transition-all hover:bg-brand-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

export const secondaryButtonClass =
  'flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-dark-850/80 px-4 py-2 text-sm font-semibold text-slate-200 shadow-sm transition hover:border-white/20 hover:bg-dark-800 active:scale-95';
