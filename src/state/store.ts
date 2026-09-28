import { useSyncExternalStore } from 'react';
import { hashPassword } from '../data/auth';
import { ledgerRepository } from '../data/repository';
import { buildDemo } from '../data/seed';
import { addMonths, monthsBetween, todayISO } from '../domain/dates';
import { calcEmi, projectSchedule, quotePayment, quoteSpend } from '../domain/loanEngine';
import { rupeesToPaise } from '../domain/money';
import type {
  CashEntry,
  Contribution,
  Goal,
  IncomeProfile,
  LedgerDb,
  Loan,
  LoanType,
  Payment,
  Spend,
  User,
} from '../domain/types';

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export interface Snapshot {
  user: User | null;
  loans: Loan[];
  payments: Payment[];
  spends: Spend[];
  goals: Goal[];
  contributions: Contribution[];
  entries: CashEntry[];
}

export interface LoanDraft {
  name: string;
  lender: string;
  type: LoanType;
  principalRupees: number;
  outstandingRupees: number;
  annualRate: number;
  startDate: string;
  emiRupees: number | null;
  dueDay: number | null;
  endDate: string | null;
  creditLimitRupees: number | null;
  interestOnly: boolean;
}

let db: LedgerDb = ledgerRepository.load();
let sessionUserId = ledgerRepository.loadSession();
const listeners = new Set<() => void>();

function belongs<T extends { userId: string }>(rows: T[], userId: string): T[] {
  return rows.filter((row) => row.userId === userId);
}

function buildSnapshot(): Snapshot {
  const user = db.users.find((item) => item.id === sessionUserId) ?? null;
  if (!user) {
    return { user: null, loans: [], payments: [], spends: [], goals: [], contributions: [], entries: [] };
  }
  return {
    user,
    loans: belongs(db.loans, user.id),
    payments: belongs(db.payments, user.id),
    spends: belongs(db.spends, user.id),
    goals: belongs(db.goals, user.id),
    contributions: belongs(db.contributions, user.id),
    entries: belongs(db.entries, user.id),
  };
}

let snapshot = buildSnapshot();

function emit() {
  ledgerRepository.save(db);
  ledgerRepository.saveSession(sessionUserId);
  snapshot = buildSnapshot();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

export function useLedger(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function currentUser(): User | null {
  return db.users.find((item) => item.id === sessionUserId) ?? null;
}

function nid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function replaceUser(next: User) {
  db = { ...db, users: db.users.map((item) => (item.id === next.id ? next : item)) };
}

export async function signup(input: {
  name: string;
  email: string;
  password: string;
}): Promise<Result> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) return { ok: false, error: 'Enter the name you want on the desk.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email.' };
  if (input.password.length < 8) return { ok: false, error: 'Use at least 8 characters for the password.' };
  if (db.users.some((item) => item.email === email)) {
    return { ok: false, error: 'An account with this email already exists.' };
  }
  const passwordSalt = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password, passwordSalt);
  const user: User = {
    id: nid('user'),
    name,
    email,
    passwordHash,
    passwordSalt,
    createdAt: todayISO(),
    onboardingComplete: false,
    income: null,
  };
  db = { ...db, users: [...db.users, user] };
  sessionUserId = user.id;
  emit();
  return { ok: true, data: undefined };
}

export async function login(input: { email: string; password: string }): Promise<Result> {
  const email = input.email.trim().toLowerCase();
  const user = db.users.find((item) => item.email === email);
  if (!user) return { ok: false, error: 'No account uses that email.' };
  const passwordHash = await hashPassword(input.password, user.passwordSalt);
  if (passwordHash !== user.passwordHash) return { ok: false, error: 'That password does not match.' };
  sessionUserId = user.id;
  emit();
  return { ok: true, data: undefined };
}

export function logout() {
  sessionUserId = null;
  emit();
}

export async function openDemo(): Promise<Result> {
  const email = 'meera@moneyres.app';
  const existing = db.users.find((item) => item.email === email);
  if (existing) {
    sessionUserId = existing.id;
    emit();
    return { ok: true, data: undefined };
  }
  const passwordSalt = crypto.randomUUID();
  const passwordHash = await hashPassword('demo1234', passwordSalt);
  const demo = buildDemo({
    userId: nid('user'),
    name: 'Meera Shah',
    email,
    passwordHash,
    passwordSalt,
    today: todayISO(),
  });
  db = {
    version: 1,
    users: [...db.users, ...demo.users],
    loans: [...db.loans, ...demo.loans],
    payments: [...db.payments, ...demo.payments],
    spends: [...db.spends, ...demo.spends],
    goals: [...db.goals, ...demo.goals],
    contributions: [...db.contributions, ...demo.contributions],
    entries: [...db.entries, ...demo.entries],
  };
  sessionUserId = demo.users[0]?.id ?? null;
  emit();
  return { ok: true, data: undefined };
}

export function saveIncome(income: IncomeProfile, markOnboarded: boolean): Result {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Sign in again.' };
  if (income.monthlyAmount <= 0) return { ok: false, error: 'Enter your monthly income.' };
  if (income.payDay < 1 || income.payDay > 31) return { ok: false, error: 'The pay day should be between 1 and 31.' };
  replaceUser({
    ...user,
    income,
    onboardingComplete: markOnboarded ? true : user.onboardingComplete,
  });
  emit();
  return { ok: true, data: undefined };
}

export function updateName(name: string): Result {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Sign in again.' };
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, error: 'Enter your name.' };
  replaceUser({ ...user, name: trimmed });
  emit();
  return { ok: true, data: undefined };
}

function draftToLoan(userId: string, draft: LoanDraft, existing?: Loan): Result<Loan> {
  const name = draft.name.trim();
  const lender = draft.lender.trim();
  if (name.length < 2) return { ok: false, error: 'Give this loan a name.' };
  if (draft.outstandingRupees <= 0) return { ok: false, error: 'Enter what is still owed.' };
  if (draft.annualRate < 0 || draft.annualRate > 80) return { ok: false, error: 'Interest should be between 0% and 80%.' };
  if (draft.dueDay == null || draft.dueDay < 1 || draft.dueDay > 31) {
    return { ok: false, error: 'Choose the day of the month this is due.' };
  }
  if (!draft.startDate) return { ok: false, error: 'Choose the day this loan started.' };
  const today = todayISO();
  const outstanding = rupeesToPaise(draft.outstandingRupees);
  let principal = rupeesToPaise(draft.principalRupees || draft.outstandingRupees);
  if (draft.type === 'credit_card') principal = existing?.principal ?? outstanding;
  if (principal < outstanding && draft.type !== 'credit_card') principal = outstanding;

  const interestOnly = draft.type !== 'credit_card' && draft.interestOnly;
  let endDate = draft.endDate || null;
  let emiAmount = draft.emiRupees && draft.emiRupees > 0 ? rupeesToPaise(draft.emiRupees) : null;
  if (interestOnly) {
    emiAmount = null;
    if (!endDate) return { ok: false, error: 'An interest-only loan needs the day the principal is due back.' };
  } else if (draft.type !== 'credit_card') {
    if (!emiAmount && !endDate) return { ok: false, error: 'Enter the EMI, or the day the loan should end.' };
    if (!emiAmount && endDate) {
      const months = Math.max(1, monthsBetween(draft.startDate, endDate));
      emiAmount = calcEmi(outstanding, draft.annualRate, months);
    }
    if (emiAmount && !endDate) {
      const projected = projectSchedule(outstanding, draft.annualRate, emiAmount, false, 480);
      endDate = projected.payoff ? addMonths(today, projected.months) : null;
    }
  }

  const creditLimit =
    draft.type === 'credit_card' && draft.creditLimitRupees && draft.creditLimitRupees > 0
      ? rupeesToPaise(draft.creditLimitRupees)
      : null;
  if (creditLimit != null && creditLimit < outstanding) {
    return { ok: false, error: 'The credit limit cannot be below the current balance.' };
  }

  const balanceChanged = existing ? existing.outstanding !== outstanding : true;
  const loan: Loan = {
    id: existing?.id ?? nid('loan'),
    userId,
    name,
    lender,
    type: draft.type,
    principal,
    outstanding,
    annualRate: draft.annualRate,
    startDate: draft.startDate,
    emiAmount,
    dueDay: draft.dueDay,
    endDate,
    creditLimit,
    interestOnly,
    lastAccrualDate: balanceChanged ? today : (existing?.lastAccrualDate ?? today),
    status: outstanding > 0 ? 'active' : 'closed',
    closedAt: outstanding > 0 ? null : (existing?.closedAt ?? today),
    createdAt: existing?.createdAt ?? today,
  };
  return { ok: true, data: loan };
}

export function saveLoan(draft: LoanDraft, loanId?: string): Result<Loan> {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Sign in again.' };
  const existing = loanId ? db.loans.find((item) => item.id === loanId && item.userId === user.id) : undefined;
  if (loanId && !existing) return { ok: false, error: 'Loan not found.' };
  const built = draftToLoan(user.id, draft, existing);
  if (!built.ok || !built.data) return { ok: false, error: built.ok ? 'Could not save the loan.' : built.error };
  const loan = built.data;
  db = {
    ...db,
    loans: existing ? db.loans.map((item) => (item.id === loan.id ? loan : item)) : [...db.loans, loan],
  };
  emit();
  return { ok: true, data: loan };
}

export function deleteLoan(loanId: string): Result {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Sign in again.' };
  if (!db.loans.some((item) => item.id === loanId && item.userId === user.id)) {
    return { ok: false, error: 'Loan not found.' };
  }
  db = {
    ...db,
    loans: db.loans.filter((item) => item.id !== loanId),
    payments: db.payments.filter((item) => item.loanId !== loanId),
    spends: db.spends.filter((item) => item.loanId !== loanId),
  };
  emit();
  return { ok: true, data: undefined };
}

export function recordPayment(
  loanId: string,
  input: { amountRupees: number; paidOn: string; note: string },
): Result<Payment> {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Sign in again.' };
  const loan = db.loans.find((item) => item.id === loanId && item.userId === user.id);
  if (!loan) return { ok: false, error: 'Loan not found.' };
  const quote = quotePayment(loan, rupeesToPaise(input.amountRupees), input.paidOn, todayISO());
  if ('error' in quote) return { ok: false, error: quote.error };
  const payment: Payment = {
    id: nid('pay'),
    loanId: loan.id,
    userId: user.id,
    amount: quote.interestPortion + quote.principalPortion,
    paidOn: input.paidOn,
    note: input.note.trim(),
    interestPortion: quote.interestPortion,
    principalPortion: quote.principalPortion,
    interestSaved: quote.interestSaved,
    balanceAfter: quote.balanceAfter,
    createdAt: todayISO(),
  };
  const nextLoan: Loan = {
    ...loan,
    outstanding: quote.balanceAfter,
    lastAccrualDate: input.paidOn,
    status: quote.closed ? 'closed' : 'active',
    closedAt: quote.closed ? input.paidOn : null,
  };
  db = {
    ...db,
    loans: db.loans.map((item) => (item.id === loan.id ? nextLoan : item)),
    payments: [...db.payments, payment],
  };
  emit();
  return { ok: true, data: payment };
}

export function recordSpend(
  loanId: string,
  input: { amountRupees: number; spentOn: string; note: string },
): Result<Spend> {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Sign in again.' };
  const loan = db.loans.find((item) => item.id === loanId && item.userId === user.id);
  if (!loan) return { ok: false, error: 'Loan not found.' };
  const quote = quoteSpend(loan, rupeesToPaise(input.amountRupees), input.spentOn, todayISO());
  if ('error' in quote) return { ok: false, error: quote.error };
  const spend: Spend = {
    id: nid('spend'),
    loanId: loan.id,
    userId: user.id,
    amount: rupeesToPaise(input.amountRupees),
    spentOn: input.spentOn,
    note: input.note.trim(),
    balanceAfter: quote.balanceAfter,
    createdAt: todayISO(),
  };
  const nextLoan: Loan = {
    ...loan,
    outstanding: quote.balanceAfter,
    lastAccrualDate: input.spentOn,
    status: 'active',
    closedAt: null,
  };
  db = {
    ...db,
    loans: db.loans.map((item) => (item.id === loan.id ? nextLoan : item)),
    spends: [...db.spends, spend],
  };
  emit();
  return { ok: true, data: spend };
}

export function saveGoal(input: {
  id?: string;
  name: string;
  targetRupees: number;
  targetDate: string | null;
  note: string;
}): Result<Goal> {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Sign in again.' };
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: 'Name the goal.' };
  if (input.targetRupees <= 0) return { ok: false, error: 'Enter the amount you want to reach.' };
  const existing = input.id
    ? db.goals.find((item) => item.id === input.id && item.userId === user.id)
    : undefined;
  if (input.id && !existing) return { ok: false, error: 'Goal not found.' };
  const goal: Goal = {
    id: existing?.id ?? nid('goal'),
    userId: user.id,
    name,
    targetAmount: rupeesToPaise(input.targetRupees),
    targetDate: input.targetDate || null,
    note: input.note.trim(),
    createdAt: existing?.createdAt ?? todayISO(),
  };
  db = {
    ...db,
    goals: existing ? db.goals.map((item) => (item.id === goal.id ? goal : item)) : [...db.goals, goal],
  };
  emit();
  return { ok: true, data: goal };
}

export function addContribution(goalId: string, input: { amountRupees: number; contributedOn: string; note: string }): Result {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Sign in again.' };
  if (!db.goals.some((item) => item.id === goalId && item.userId === user.id)) {
    return { ok: false, error: 'Goal not found.' };
  }
  if (input.amountRupees <= 0) return { ok: false, error: 'Enter how much you set aside.' };
  if (input.contributedOn > todayISO()) return { ok: false, error: 'A contribution can’t be in the future.' };
  const contribution: Contribution = {
    id: nid('contrib'),
    goalId,
    userId: user.id,
    amount: rupeesToPaise(input.amountRupees),
    contributedOn: input.contributedOn,
    note: input.note.trim(),
    createdAt: todayISO(),
  };
  db = { ...db, contributions: [...db.contributions, contribution] };
  emit();
  return { ok: true, data: undefined };
}

export function deleteGoal(goalId: string): Result {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Sign in again.' };
  db = {
    ...db,
    goals: db.goals.filter((item) => !(item.id === goalId && item.userId === user.id)),
    contributions: db.contributions.filter((item) => !(item.goalId === goalId && item.userId === user.id)),
  };
  emit();
  return { ok: true, data: undefined };
}

export function addEntry(input: {
  kind: 'income' | 'expense';
  category: string;
  amountRupees: number;
  occurredOn: string;
  note: string;
}): Result {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Sign in again.' };
  if (!input.category.trim()) return { ok: false, error: 'Choose a category.' };
  if (input.amountRupees <= 0) return { ok: false, error: 'Enter an amount.' };
  if (input.occurredOn > todayISO()) return { ok: false, error: 'That date is still in the future.' };
  const entry: CashEntry = {
    id: nid('entry'),
    userId: user.id,
    kind: input.kind,
    category: input.category,
    amount: rupeesToPaise(input.amountRupees),
    occurredOn: input.occurredOn,
    note: input.note.trim(),
    createdAt: todayISO(),
  };
  db = { ...db, entries: [...db.entries, entry] };
  emit();
  return { ok: true, data: undefined };
}

export function deleteEntry(entryId: string): Result {
  const user = currentUser();
  if (!user) return { ok: false, error: 'Sign in again.' };
  db = { ...db, entries: db.entries.filter((item) => !(item.id === entryId && item.userId === user.id)) };
  emit();
  return { ok: true, data: undefined };
}
