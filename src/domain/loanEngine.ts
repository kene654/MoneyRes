/**
 * Pure loan math. Amounts are integer paise.
 * Screens and storage stay outside this file so web and native apps share one set of rules.
 */
import { daysBetween, monthsBetween } from './dates';
import type { Loan } from './types';

export interface PaymentQuote {
  accrued: number;
  interestPortion: number;
  principalPortion: number;
  unpaidInterest: number;
  surplus: number;
  balanceAfter: number;
  interestSaved: number;
  closed: boolean;
}

export interface ScheduleProjection {
  interest: number;
  months: number;
  payoff: boolean;
  trapped: boolean;
}

export function monthlyInterest(balancePaise: number, annualRate: number): number {
  if (balancePaise <= 0 || annualRate <= 0) return 0;
  return Math.round((balancePaise * annualRate) / 100 / 12);
}

export function calcEmi(principalPaise: number, annualRate: number, months: number): number {
  const n = Math.max(1, Math.round(months));
  if (principalPaise <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return Math.round(principalPaise / n);
  const growth = (1 + r) ** n;
  return Math.round((principalPaise * r * growth) / (growth - 1));
}

export function scheduledMonthlyPayment(
  loan: Pick<Loan, 'interestOnly' | 'emiAmount' | 'type' | 'outstanding' | 'annualRate' | 'endDate'>,
  asOf: string,
): number {
  if (loan.interestOnly) return monthlyInterest(loan.outstanding, loan.annualRate);
  if (loan.emiAmount && loan.emiAmount > 0) return loan.emiAmount;
  if (loan.type === 'credit_card') return Math.max(50_000, Math.round(loan.outstanding * 0.05));
  const months = loan.endDate ? Math.max(1, monthsBetween(asOf, loan.endDate)) : 36;
  return calcEmi(loan.outstanding, loan.annualRate, months);
}

export function projectSchedule(
  balance: number,
  annualRate: number,
  payment: number,
  interestOnly: boolean,
  horizonMonths: number,
): ScheduleProjection {
  if (balance <= 0) return { interest: 0, months: 0, payoff: true, trapped: false };
  const r = annualRate / 100 / 12;
  if (interestOnly) {
    const months = Math.max(0, horizonMonths);
    return {
      interest: monthlyInterest(balance, annualRate) * months,
      months,
      payoff: false,
      trapped: false,
    };
  }
  if (payment <= 0) {
    return { interest: monthlyInterest(balance, annualRate) * 12, months: 12, payoff: false, trapped: true };
  }

  let bal = balance;
  let interest = 0;
  let months = 0;
  while (bal > 0 && months < 480) {
    const dueInterest = Math.round(bal * r);
    if (payment <= dueInterest) {
      return { interest: interest + dueInterest * 12, months, payoff: false, trapped: true };
    }
    interest += dueInterest;
    bal -= Math.min(bal, payment - dueInterest);
    months += 1;
  }
  return { interest, months, payoff: bal <= 0, trapped: false };
}

function horizonMonths(loan: Pick<Loan, 'interestOnly' | 'endDate'>, asOf: string): number {
  if (!loan.interestOnly) return 480;
  if (!loan.endDate) return 12;
  return monthsBetween(asOf, loan.endDate);
}

export function futureInterest(loan: Loan, balance: number, asOf: string): number {
  const payment = loan.interestOnly
    ? monthlyInterest(balance, loan.annualRate)
    : scheduledMonthlyPayment({ ...loan, outstanding: balance }, asOf);
  return projectSchedule(
    balance,
    loan.annualRate,
    payment,
    loan.interestOnly,
    horizonMonths(loan, asOf),
  ).interest;
}

export function isTrapped(loan: Loan, asOf: string): boolean {
  if (loan.interestOnly || loan.status !== 'active' || loan.outstanding <= 0) return false;
  return scheduledMonthlyPayment(loan, asOf) <= monthlyInterest(loan.outstanding, loan.annualRate);
}

export function quotePayment(
  loan: Loan,
  amount: number,
  paidOn: string,
  today: string,
): PaymentQuote | { error: string } {
  if (loan.status === 'closed' || loan.outstanding <= 0) return { error: 'This loan is already closed.' };
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter an amount greater than zero.' };
  if (paidOn < loan.lastAccrualDate) {
    return { error: 'That date is before the balance was last updated.' };
  }
  if (paidOn > today) return { error: 'A payment can’t be recorded in the future.' };

  const days = Math.max(0, daysBetween(loan.lastAccrualDate, paidOn));
  const accrued =
    loan.annualRate <= 0 ? 0 : Math.round(loan.outstanding * (loan.annualRate / 100) * (days / 365));
  const interestPortion = Math.min(amount, accrued);
  const unpaidInterest = accrued - interestPortion;
  const towardPrincipal = amount - interestPortion;
  const principalPortion = Math.min(loan.outstanding, towardPrincipal);
  const surplus = towardPrincipal - principalPortion;
  const balanceAfter = loan.outstanding - principalPortion + unpaidInterest;

  const due = scheduledMonthlyPayment(loan, paidOn);
  let interestSaved = 0;
  if (unpaidInterest === 0 && amount > due && principalPortion > 0) {
    const baselineInterest = Math.min(due, accrued);
    const baselinePrincipal = Math.min(loan.outstanding, Math.max(0, due - accrued));
    const baselineUnpaid = accrued - baselineInterest;
    const baselineBalance = loan.outstanding - baselinePrincipal + baselineUnpaid;
    const saved =
      futureInterest({ ...loan, outstanding: baselineBalance }, baselineBalance, paidOn) -
      futureInterest({ ...loan, outstanding: balanceAfter }, balanceAfter, paidOn);
    interestSaved = Math.max(0, saved);
  }

  return {
    accrued,
    interestPortion,
    principalPortion,
    unpaidInterest,
    surplus,
    balanceAfter,
    interestSaved,
    closed: balanceAfter <= 0,
  };
}

export function quoteSpend(
  loan: Loan,
  amount: number,
  spentOn: string,
  today: string,
): { accrued: number; balanceAfter: number } | { error: string } {
  if (loan.type !== 'credit_card') return { error: 'Spends are recorded on credit cards.' };
  if (loan.status === 'closed') return { error: 'This card is already clear.' };
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter a spend greater than zero.' };
  if (spentOn < loan.lastAccrualDate) return { error: 'That date is before the balance was last updated.' };
  if (spentOn > today) return { error: 'A spend can’t be recorded in the future.' };
  const days = Math.max(0, daysBetween(loan.lastAccrualDate, spentOn));
  const accrued =
    loan.annualRate <= 0 ? 0 : Math.round(loan.outstanding * (loan.annualRate / 100) * (days / 365));
  return { accrued, balanceAfter: loan.outstanding + accrued + amount };
}

/** ₹5,000 is the common extra-payment unit used to compare loans. */
export const COMPARE_EXTRA_PAISE = 500_000;

export function payoffMonths(loan: Loan, asOf: string): number | null {
  if (loan.outstanding <= 0) return 0;
  if (loan.interestOnly) return loan.endDate ? monthsBetween(asOf, loan.endDate) : null;
  const payment = scheduledMonthlyPayment(loan, asOf);
  const projected = projectSchedule(loan.outstanding, loan.annualRate, payment, false, 480);
  return projected.payoff ? projected.months : null;
}
