import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return <button className={`btn btn-${variant} ${className}`.trim()} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error ? <small className="field-error">{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Meter({ value, tone = 'gold' }: { value: number; tone?: 'gold' | 'sage' | 'clay' }) {
  const width = `${Math.max(0, Math.min(100, value * 100))}%`;
  return (
    <div
      className={`meter tone-${tone}`}
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width }} />
    </div>
  );
}

export function Ring({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const safe = Math.max(0, Math.min(1, value));
  return (
    <div className="ring">
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle className="ring-track" cx="70" cy="70" r={radius} />
        <circle
          className="ring-value"
          cx="70"
          cy="70"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - safe)}
        />
      </svg>
      <div className="ring-label">
        <strong>{label}</strong>
        {sub ? <span>{sub}</span> : null}
      </div>
    </div>
  );
}

export function PageHead({
  kicker,
  title,
  lede,
  children,
}: {
  kicker?: string;
  title: string;
  lede?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-row">
        <div>
          {kicker ? <p className="kicker">{kicker}</p> : null}
          <h1>{title}</h1>
        </div>
        {children}
      </div>
      {lede ? <p className="lede">{lede}</p> : null}
    </header>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="error-banner" role="alert">
      {children}
    </p>
  );
}
