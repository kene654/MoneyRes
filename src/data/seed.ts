import { addDays, addMonths, monthKey, parseISO, todayISO } from '../domain/dates';
import { quotePayment, scheduledMonthlyPayment } from '../domain/loanEngine';
import { rupeesToPaise } from '../domain/money';
import type {
  CashEntry,
  Contribution,
  Goal,
  LedgerDb,
  Loan,
  Payment,
  User,
} from '../domain/types';

export interface DemoInput {
  userId: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  today: string;
}

function dueDayAfter(today: string, offset: number): number {
  return parseISO(addDays(today, offset)).getDate();
}

function makeLoan(partial: Loan): Loan {
  return partial;
}

export function buildDemo(input: DemoInput): Omit<LedgerDb, 'version'> {
  const { userId, today } = input;
  let sequence = 0;
  const nid = (prefix: string) => `${prefix}_demo_${++sequence}`;

  const user: User = {
    id: userId,
    name: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
    passwordSalt: input.passwordSalt,
    createdAt: today,
    onboardingComplete: true,
    income: {
      type: 'employed',
      monthlyAmount: rupeesToPaise(185_000),
      payDay: 1,
      source: 'Studio payroll',
    },
  };

  const home = makeLoan({
    id: nid('loan'),
    userId,
    name: 'Home loan',
    lender: 'State Bank of India',
    type: 'home',
    principal: rupeesToPaise(5_200_000),
    outstanding: rupeesToPaise(4_680_000),
    annualRate: 8.35,
    startDate: '2022-04-05',
    emiAmount: rupeesToPaise(44_200),
    dueDay: dueDayAfter(today, 16),
    endDate: '2042-04-05',
    creditLimit: null,
    interestOnly: false,
    lastAccrualDate: today,
    status: 'active',
    closedAt: null,
    createdAt: today,
  });

  const car = makeLoan({
    id: nid('loan'),
    userId,
    name: 'City car',
    lender: 'HDFC Bank',
    type: 'vehicle',
    principal: rupeesToPaise(940_000),
    outstanding: rupeesToPaise(515_000),
    annualRate: 9.25,
    startDate: '2024-06-12',
    emiAmount: rupeesToPaise(19_650),
    dueDay: dueDayAfter(today, 12),
    endDate: '2029-06-12',
    creditLimit: null,
    interestOnly: false,
    lastAccrualDate: today,
    status: 'active',
    closedAt: null,
    createdAt: today,
  });

  const gold = makeLoan({
    id: nid('loan'),
    userId,
    name: 'Gold loan',
    lender: 'Muthoot Finance',
    type: 'gold',
    principal: rupeesToPaise(200_000),
    outstanding: rupeesToPaise(200_000),
    annualRate: 11.5,
    startDate: addMonths(today, -4),
    emiAmount: null,
    dueDay: dueDayAfter(today, 8),
    endDate: addMonths(today, 8),
    creditLimit: null,
    interestOnly: true,
    lastAccrualDate: today,
    status: 'active',
    closedAt: null,
    createdAt: today,
  });

  const personal = makeLoan({
    id: nid('loan'),
    userId,
    name: 'Personal EMI',
    lender: 'Bajaj Finance',
    type: 'emi',
    principal: rupeesToPaise(180_000),
    outstanding: rupeesToPaise(96_000),
    annualRate: 15.5,
    startDate: addMonths(today, -10),
    emiAmount: rupeesToPaise(8_740),
    dueDay: dueDayAfter(today, 20),
    endDate: addMonths(today, 18),
    creditLimit: null,
    interestOnly: false,
    lastAccrualDate: today,
    status: 'active',
    closedAt: null,
    createdAt: today,
  });

  let card = makeLoan({
    id: nid('loan'),
    userId,
    name: 'Axis Ace',
    lender: 'Axis Bank',
    type: 'credit_card',
    principal: rupeesToPaise(86_400),
    outstanding: rupeesToPaise(86_400),
    annualRate: 37.2,
    startDate: addMonths(today, -6),
    emiAmount: rupeesToPaise(12_000),
    dueDay: dueDayAfter(today, 6),
    endDate: null,
    creditLimit: rupeesToPaise(250_000),
    interestOnly: false,
    lastAccrualDate: addDays(today, -32),
    status: 'active',
    closedAt: null,
    createdAt: today,
  });

  const regular = scheduledMonthlyPayment(card, today);
  const quote = quotePayment(card, regular + rupeesToPaise(5_000), today, today);
  if ('error' in quote) throw new Error(quote.error);
  const cardPayment: Payment = {
    id: nid('pay'),
    loanId: card.id,
    userId,
    amount: quote.interestPortion + quote.principalPortion,
    paidOn: today,
    note: 'Paid more than the usual amount',
    interestPortion: quote.interestPortion,
    principalPortion: quote.principalPortion,
    interestSaved: quote.interestSaved,
    balanceAfter: quote.balanceAfter,
    createdAt: today,
  };
  card = {
    ...card,
    outstanding: quote.balanceAfter,
    lastAccrualDate: today,
    principal: rupeesToPaise(86_400),
  };

  const emergencyId = nid('goal');
  const collegeId = nid('goal');
  const goals: Goal[] = [
    {
      id: emergencyId,
      userId,
      name: 'Emergency fund',
      targetAmount: rupeesToPaise(300_000),
      targetDate: addMonths(today, 14),
      note: 'Six weeks of expenses, kept away from lenders.',
      createdAt: today,
    },
    {
      id: collegeId,
      userId,
      name: 'College fund',
      targetAmount: rupeesToPaise(150_000),
      targetDate: addMonths(today, 20),
      note: '',
      createdAt: today,
    },
  ];

  const contributions: Contribution[] = [
    {
      id: nid('contrib'),
      goalId: emergencyId,
      userId,
      amount: rupeesToPaise(125_000),
      contributedOn: addDays(today, -12),
      note: 'Opening amount',
      createdAt: addDays(today, -12),
    },
    {
      id: nid('contrib'),
      goalId: collegeId,
      userId,
      amount: rupeesToPaise(40_000),
      contributedOn: addDays(today, -4),
      note: '',
      createdAt: addDays(today, -4),
    },
  ];

  const month = monthKey(today);
  const onDay = (day: number) => {
    const iso = `${month}-${String(day).padStart(2, '0')}`;
    return iso > today ? today : iso;
  };
  const entries: CashEntry[] = [
    ['Salary', 'income', 185_000, onDay(1), 'Monthly salary'],
    ['Rent', 'expense', 32_000, onDay(2), ''],
    ['Food', 'expense', 14_500, onDay(8), ''],
    ['Transport', 'expense', 4_200, onDay(14), ''],
    ['Utilities', 'expense', 2_800, onDay(16), ''],
  ].map(([category, kind, rupees, occurredOn, note]) => ({
    id: nid('entry'),
    userId,
    kind: kind as 'income' | 'expense',
    category: String(category),
    amount: rupeesToPaise(Number(rupees)),
    occurredOn: String(occurredOn),
    note: String(note),
    createdAt: String(occurredOn),
  }));

  return {
    users: [user],
    loans: [home, car, gold, card, personal],
    payments: [cardPayment],
    spends: [],
    goals,
    contributions,
    entries,
  };
}

export function demoToday(): string {
  return todayISO();
}
