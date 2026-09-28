export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(now = new Date()): string {
  return toISO(now);
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

export function addMonths(iso: string, months: number): string {
  const date = parseISO(iso);
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const dim = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, dim));
  return toISO(target);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

export function formatDate(iso: string): string {
  return parseISO(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDayMonth(iso: string): { day: string; month: string } {
  const date = parseISO(iso);
  return {
    day: String(date.getDate()),
    month: date.toLocaleDateString('en-IN', { month: 'short' }),
  };
}

/** Whole-month span from `from` to `to`. A later day in an earlier month still counts the month boundary. */
export function monthsBetween(from: string, to: string): number {
  if (to <= from) return 0;
  const a = parseISO(from);
  const b = parseISO(to);
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return Math.max(1, months);
}

export function dateWithDay(year: number, monthIndex: number, dueDay: number): string {
  const dim = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(Math.max(1, dueDay), dim);
  return toISO(new Date(year, monthIndex, day));
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
