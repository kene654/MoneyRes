import { dueInfo, type DueInfo } from './dues';
import {
  COMPARE_EXTRA_PAISE,
  isTrapped,
  monthlyInterest,
  quotePayment,
  scheduledMonthlyPayment,
} from './loanEngine';
import type { Loan, Payment } from './types';

export interface Advice {
  kind: 'protect' | 'trap' | 'reduce';
  loan: Loan;
  /** Total to send today, including the regular amount when that still helps. */
  amount: number;
  extra: number;
  interestSaved: number;
  due: DueInfo | null;
  alternative: { loan: Loan; interestSaved: number } | null;
  /** A higher-rate loan that still saves less, usually because it would be cleared sooner. */
  higherRate: { loan: Loan; interestSaved: number } | null;
}

function reduction(loan: Loan, today: string): { amount: number; extra: number; saved: number } {
  const regular = scheduledMonthlyPayment(loan, today);
  const room = loan.outstanding;
  const extra = Math.min(COMPARE_EXTRA_PAISE, room);
  let amount = Math.min(room, regular + extra);
  if (amount <= regular && room > regular) amount = Math.min(room, regular + extra);
  if (amount <= 0) return { amount: 0, extra: 0, saved: 0 };
  const quote = quotePayment(loan, amount, today, today);
  if ('error' in quote) return { amount: 0, extra: 0, saved: 0 };
  const paidExtra = Math.max(0, amount - regular);
  return { amount, extra: paidExtra, saved: quote.interestSaved };
}

export function advise(loans: Loan[], payments: Payment[], today: string): Advice | null {
  const active = loans.filter((loan) => loan.status === 'active' && loan.outstanding > 0);
  if (active.length === 0) return null;

  const withDue = active.map((loan) => ({ loan, due: dueInfo(loan, payments, today) }));
  const urgent = withDue
    .filter(({ due }) => due && (due.state !== 'upcoming' || due.days <= 2))
    .sort((a, b) => {
      const aDays = a.due?.state === 'overdue' ? -a.due.days : (a.due?.days ?? 99);
      const bDays = b.due?.state === 'overdue' ? -b.due.days : (b.due?.days ?? 99);
      return aDays - bDays || b.loan.annualRate - a.loan.annualRate;
    });

  if (urgent[0]?.due) {
    const { loan, due } = urgent[0];
    const regular = Math.min(loan.outstanding, scheduledMonthlyPayment(loan, today));
    return {
      kind: 'protect',
      loan,
      amount: Math.max(regular, 1),
      extra: 0,
      interestSaved: 0,
      due,
      alternative: null,
      higherRate: null,
    };
  }

  const trapped = active
    .filter((loan) => isTrapped(loan, today))
    .sort((a, b) => b.annualRate - a.annualRate);
  if (trapped[0]) {
    const loan = trapped[0];
    const interest = monthlyInterest(loan.outstanding, loan.annualRate);
    const amount = Math.min(loan.outstanding + interest, interest + COMPARE_EXTRA_PAISE);
    const quote = quotePayment(loan, amount, today, today);
    return {
      kind: 'trap',
      loan,
      amount,
      extra: Math.max(0, amount - scheduledMonthlyPayment(loan, today)),
      interestSaved: 'error' in quote ? 0 : quote.interestSaved,
      due: dueInfo(loan, payments, today),
      alternative: null,
      higherRate: null,
    };
  }

  const ranked = active
    .map((loan) => ({ loan, offer: reduction(loan, today), due: dueInfo(loan, payments, today) }))
    .filter((item) => item.offer.saved > 0 && item.offer.amount > 0)
    .sort((a, b) => b.offer.saved - a.offer.saved || b.loan.annualRate - a.loan.annualRate);

  if (!ranked[0]) {
    const soonest = withDue
      .filter((item) => item.due)
      .sort((a, b) => (a.due?.date ?? '').localeCompare(b.due?.date ?? ''))[0];
    if (!soonest?.due) return null;
    return {
      kind: 'protect',
      loan: soonest.loan,
      amount: Math.min(soonest.loan.outstanding, scheduledMonthlyPayment(soonest.loan, today)),
      extra: 0,
      interestSaved: 0,
      due: soonest.due,
      alternative: null,
      higherRate: null,
    };
  }

  const best = ranked[0];
  const runner = ranked[1];
  const costlier = ranked
    .filter((item) => item.loan.id !== best.loan.id && item.loan.annualRate > best.loan.annualRate + 3)
    .sort((a, b) => b.loan.annualRate - a.loan.annualRate)[0];
  return {
    kind: 'reduce',
    loan: best.loan,
    amount: best.offer.amount,
    extra: best.offer.extra,
    interestSaved: best.offer.saved,
    due: best.due,
    alternative: runner ? { loan: runner.loan, interestSaved: runner.offer.saved } : null,
    higherRate:
      costlier && costlier.loan.id !== runner?.loan.id
        ? { loan: costlier.loan, interestSaved: costlier.offer.saved }
        : null,
  };
}
