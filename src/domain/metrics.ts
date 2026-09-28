import { dueInfo, type DueInfo } from './dues';
import { futureInterest, scheduledMonthlyPayment } from './loanEngine';
import type { CashEntry, Contribution, Goal, Loan, LoanType, Payment } from './types';

export interface TypeSlice {
  type: LoanType;
  outstanding: number;
  count: number;
  share: number;
}

export interface DueRow {
  loan: Loan;
  due: DueInfo;
  amount: number;
}

export interface DashboardModel {
  totalOutstanding: number;
  termPrincipal: number;
  termOutstanding: number;
  clearedAmount: number;
  clearedRatio: number;
  remainingInterest: number;
  blendedRate: number | null;
  interestSaved: number;
  interestPaid: number;
  monthlyCommitment: number;
  incomeShare: number | null;
  dues: DueRow[];
  byType: TypeSlice[];
  cardBalance: number;
  cardLimit: number;
  activeCount: number;
}

export function buildDashboard(
  loans: Loan[],
  payments: Payment[],
  monthlyIncome: number | null,
  today: string,
): DashboardModel {
  const active = loans.filter((loan) => loan.status === 'active' && loan.outstanding > 0);
  const term = active.filter((loan) => loan.type !== 'credit_card');
  const termPrincipal = term.reduce((sum, loan) => sum + loan.principal, 0);
  const termOutstanding = term.reduce((sum, loan) => sum + loan.outstanding, 0);
  const cleared = Math.max(0, termPrincipal - termOutstanding);
  const totalOutstanding = active.reduce((sum, loan) => sum + loan.outstanding, 0);
  const monthlyCommitment = active.reduce((sum, loan) => sum + scheduledMonthlyPayment(loan, today), 0);
  const cards = active.filter((loan) => loan.type === 'credit_card');
  const byTypeMap = new Map<LoanType, TypeSlice>();
  for (const loan of active) {
    const current = byTypeMap.get(loan.type) ?? { type: loan.type, outstanding: 0, count: 0, share: 0 };
    current.outstanding += loan.outstanding;
    current.count += 1;
    byTypeMap.set(loan.type, current);
  }
  const byType = [...byTypeMap.values()]
    .map((slice) => ({
      ...slice,
      share: totalOutstanding > 0 ? slice.outstanding / totalOutstanding : 0,
    }))
    .sort((a, b) => b.outstanding - a.outstanding);

  const remainingInterest = active.reduce(
    (sum, loan) => sum + (loan.outstanding > 0 ? futureInterest(loan, loan.outstanding, today) : 0),
    0,
  );
  const blendedRate =
    totalOutstanding > 0
      ? active.reduce((sum, loan) => sum + loan.outstanding * loan.annualRate, 0) / totalOutstanding
      : null;

  const dues = active
    .map((loan) => {
      const due = dueInfo(loan, payments, today);
      if (!due) return null;
      return { loan, due, amount: scheduledMonthlyPayment(loan, today) };
    })
    .filter((row): row is DueRow => row !== null)
    .sort((a, b) => a.due.date.localeCompare(b.due.date));

  return {
    totalOutstanding,
    termPrincipal,
    termOutstanding,
    clearedAmount: cleared,
    clearedRatio: termPrincipal > 0 ? cleared / termPrincipal : 0,
    remainingInterest,
    blendedRate,
    interestSaved: payments.reduce((sum, payment) => sum + payment.interestSaved, 0),
    interestPaid: payments.reduce((sum, payment) => sum + payment.interestPortion, 0),
    monthlyCommitment,
    incomeShare: monthlyIncome && monthlyIncome > 0 ? monthlyCommitment / monthlyIncome : null,
    dues,
    byType,
    cardBalance: cards.reduce((sum, loan) => sum + loan.outstanding, 0),
    cardLimit: cards.reduce((sum, loan) => sum + (loan.creditLimit ?? 0), 0),
    activeCount: active.length,
  };
}

export interface LoanInsight {
  interestPaid: number;
  interestSaved: number;
  remainingInterest: number;
  completion: number;
  utilization: number | null;
}

export function loanInsight(loan: Loan, payments: Payment[], today: string): LoanInsight {
  const mine = payments.filter((payment) => payment.loanId === loan.id);
  const base = loan.principal > 0 ? loan.principal : loan.outstanding;
  return {
    interestPaid: mine.reduce((sum, payment) => sum + payment.interestPortion, 0),
    interestSaved: mine.reduce((sum, payment) => sum + payment.interestSaved, 0),
    remainingInterest: loan.outstanding > 0 ? futureInterest(loan, loan.outstanding, today) : 0,
    completion: loan.type === 'credit_card' ? 0 : Math.max(0, Math.min(1, (base - loan.outstanding) / base)),
    utilization:
      loan.type === 'credit_card' && loan.creditLimit
        ? Math.max(0, Math.min(1, loan.outstanding / loan.creditLimit))
        : null,
  };
}

export function goalSaved(goalId: string, contributions: Contribution[]): number {
  return contributions
    .filter((item) => item.goalId === goalId)
    .reduce((sum, item) => sum + item.amount, 0);
}

export function monthEntries(entries: CashEntry[], month: string): CashEntry[] {
  return entries
    .filter((entry) => entry.occurredOn.startsWith(month))
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
}

export function sumKind(entries: CashEntry[], kind: 'income' | 'expense'): number {
  return entries.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.amount, 0);
}

export function goalsWithProgress(goals: Goal[], contributions: Contribution[]) {
  return goals
    .map((goal) => {
      const saved = goalSaved(goal.id, contributions);
      return {
        goal,
        saved,
        ratio: goal.targetAmount > 0 ? Math.min(1, saved / goal.targetAmount) : 0,
      };
    })
    .sort((a, b) => a.ratio - b.ratio);
}
