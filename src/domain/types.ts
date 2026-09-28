/** Ledger records. Money fields are integer paise so totals do not drift. */

export type LoanType = 'emi' | 'gold' | 'vehicle' | 'home' | 'credit_card' | 'other';

export type IncomeKind = 'employed' | 'self';

export interface IncomeProfile {
  type: IncomeKind;
  /** Monthly salary or typical self-employed income, in paise. */
  monthlyAmount: number;
  /** Day of month the money usually arrives, 1–31. */
  payDay: number;
  source: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  onboardingComplete: boolean;
  income: IncomeProfile | null;
}

export interface Loan {
  id: string;
  userId: string;
  name: string;
  lender: string;
  type: LoanType;
  /** Original amount borrowed, or the card balance when it was added. Paise. */
  principal: number;
  outstanding: number;
  /** Nominal annual interest, percent. 12.5 means 12.5% a year. */
  annualRate: number;
  startDate: string;
  /** Contracted EMI, usual card payment, or null for interest-only. Paise. */
  emiAmount: number | null;
  dueDay: number | null;
  endDate: string | null;
  creditLimit: number | null;
  interestOnly: boolean;
  /** Outstanding is the balance as of this date. Later interest accrues from here. */
  lastAccrualDate: string;
  status: 'active' | 'closed';
  closedAt: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  loanId: string;
  userId: string;
  /** Amount actually applied to interest and principal, in paise. */
  amount: number;
  paidOn: string;
  note: string;
  interestPortion: number;
  principalPortion: number;
  /** Future interest avoided versus paying only the regular amount. */
  interestSaved: number;
  balanceAfter: number;
  createdAt: string;
}

export interface Spend {
  id: string;
  loanId: string;
  userId: string;
  amount: number;
  spentOn: string;
  note: string;
  balanceAfter: number;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  note: string;
  createdAt: string;
}

export interface Contribution {
  id: string;
  goalId: string;
  userId: string;
  amount: number;
  contributedOn: string;
  note: string;
  createdAt: string;
}

export interface CashEntry {
  id: string;
  userId: string;
  kind: 'income' | 'expense';
  category: string;
  amount: number;
  occurredOn: string;
  note: string;
  createdAt: string;
}

export interface LedgerDb {
  version: 1;
  users: User[];
  loans: Loan[];
  payments: Payment[];
  spends: Spend[];
  goals: Goal[];
  contributions: Contribution[];
  entries: CashEntry[];
}

export const LOAN_TYPES: { id: LoanType; label: string; blurb: string }[] = [
  { id: 'emi', label: 'Personal EMI', blurb: 'Fixed monthly installment' },
  { id: 'gold', label: 'Gold loan', blurb: 'Borrowed against gold' },
  { id: 'vehicle', label: 'Vehicle', blurb: 'Car, bike, or other' },
  { id: 'home', label: 'Home loan', blurb: 'House or plot' },
  { id: 'credit_card', label: 'Credit card', blurb: 'Revolving card balance' },
  { id: 'other', label: 'Other', blurb: 'Any other borrowing' },
];

export const EXPENSE_CATEGORIES = [
  'Rent',
  'Food',
  'Transport',
  'Utilities',
  'Family',
  'Education',
  'Health',
  'Shopping',
  'Other',
] as const;

export const INCOME_CATEGORIES = ['Salary', 'Business', 'Freelance', 'Other'] as const;

export function loanTypeLabel(type: LoanType): string {
  return LOAN_TYPES.find((item) => item.id === type)?.label ?? 'Loan';
}
