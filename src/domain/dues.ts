import { addDays, addMonths, dateWithDay, daysBetween, parseISO } from './dates';
import { scheduledMonthlyPayment } from './loanEngine';
import type { Loan, Payment } from './types';

export interface DueInfo {
  date: string;
  state: 'overdue' | 'today' | 'upcoming';
  days: number;
}

function shiftMonth(year: number, monthIndex: number, delta: number): { year: number; monthIndex: number } {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

/**
 * Only the latest due on or after the day the loan was added can be overdue.
 * Older installments are already inside the balance the person entered.
 */
export function dueInfo(loan: Loan, payments: Payment[], today: string): DueInfo | null {
  if (loan.status !== 'active' || loan.dueDay == null || loan.outstanding <= 0) return null;

  const cursor = parseISO(today);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const thisDue = dateWithDay(year, month, loan.dueDay);
  const previous = shiftMonth(year, month, -1);
  const prevDue = dateWithDay(previous.year, previous.monthIndex, loan.dueDay);
  const next = shiftMonth(year, month, 1);
  const nextDue = dateWithDay(next.year, next.monthIndex, loan.dueDay);
  const origin = loan.createdAt;
  const scheduled = Math.max(1, scheduledMonthlyPayment(loan, today));

  const covered = (dueDate: string) => {
    const windowStart = addDays(dueDate, -5);
    const windowEnd = addMonths(dueDate, 1);
    return payments.some(
      (payment) =>
        payment.loanId === loan.id &&
        payment.paidOn >= windowStart &&
        payment.paidOn < windowEnd &&
        payment.paidOn <= today &&
        payment.amount >= scheduled * 0.8,
    );
  };

  const past = [prevDue, thisDue].filter((date) => date >= origin && date <= today).sort().at(-1);
  if (past && !covered(past)) {
    if (past === today) return { date: past, state: 'today', days: 0 };
    return { date: past, state: 'overdue', days: daysBetween(past, today) };
  }

  const future = [thisDue, nextDue].find((date) => date > today);
  if (!future) return null;
  return { date: future, state: 'upcoming', days: daysBetween(today, future) };
}

export function duePhrase(due: DueInfo): string {
  if (due.state === 'today') return 'Due today';
  if (due.state === 'overdue') return due.days === 1 ? '1 day overdue' : `${due.days} days overdue`;
  if (due.days === 1) return 'Due tomorrow';
  return `Due in ${due.days} days`;
}
