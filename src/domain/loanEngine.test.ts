import { describe, expect, it } from 'vitest';
import { dueInfo } from './dues';
import { buildDemo } from '../data/seed';
import { calcEmi, monthlyInterest, quotePayment } from './loanEngine';
import { advise } from './suggestions';
import type { Loan, Payment } from './types';

const today = '2026-09-28';

function loan(partial: Partial<Loan> & Pick<Loan, 'id'>): Loan {
  return {
    userId: 'u',
    name: 'Test loan',
    lender: 'Bank',
    type: 'emi',
    principal: 10_000_000,
    outstanding: 10_000_000,
    annualRate: 12,
    startDate: '2026-01-01',
    emiAmount: 500_000,
    dueDay: 8,
    endDate: '2028-01-01',
    creditLimit: null,
    interestOnly: false,
    lastAccrualDate: today,
    status: 'active',
    closedAt: null,
    createdAt: '2026-01-01',
    ...partial,
  };
}

describe('calcEmi', () => {
  it('matches the standard reducing-balance formula', () => {
    const principal = 10_000_000;
    const r = 0.01;
    const n = 12;
    const expected = Math.round((principal * r * (1 + r) ** n) / ((1 + r) ** n - 1));
    expect(calcEmi(principal, 12, 12)).toBe(expected);
    expect(calcEmi(principal, 0, 10)).toBe(1_000_000);
  });
});

describe('quotePayment', () => {
  it('capitalizes interest a short payment does not cover', () => {
    const sample = loan({
      id: 'short',
      outstanding: 1_000_000,
      annualRate: 12,
      lastAccrualDate: '2026-09-01',
      emiAmount: 100_000,
    });
    const accrued = Math.round(1_000_000 * 0.12 * (30 / 365));
    const quote = quotePayment(sample, 1_000, '2026-10-01', '2026-10-01');
    if ('error' in quote) throw new Error(quote.error);
    expect(quote.accrued).toBe(accrued);
    expect(quote.principalPortion).toBe(0);
    expect(quote.balanceAfter).toBe(1_000_000 + accrued - 1_000);
  });

  it('counts an extra payment as interest avoided and ignores the regular amount', () => {
    const sample = loan({
      id: 'extra',
      interestOnly: true,
      type: 'gold',
      outstanding: 10_000_000,
      annualRate: 20,
      emiAmount: null,
      endDate: '2027-09-28',
      lastAccrualDate: today,
      createdAt: today,
    });
    const regular = monthlyInterest(10_000_000, 20);
    const exact = quotePayment(sample, regular, today, today);
    const extra = quotePayment(sample, regular + 500_000, today, today);
    if ('error' in exact) throw new Error(exact.error);
    if ('error' in extra) throw new Error(extra.error);
    expect(exact.interestSaved).toBe(0);
    expect(extra.interestSaved).toBeGreaterThan(0);
  });
});

describe('advise', () => {
  it('puts an overdue installment ahead of a costlier loan', () => {
    const cheap = loan({ id: 'cheap', name: 'Home', annualRate: 5, dueDay: 27, type: 'home' });
    const costly = loan({
      id: 'costly',
      name: 'Card',
      type: 'credit_card',
      annualRate: 40,
      dueDay: 8,
      emiAmount: 200_000,
      creditLimit: 20_000_000,
      createdAt: today,
    });
    const advice = advise([cheap, costly], [], today);
    expect(advice?.kind).toBe('protect');
    expect(advice?.loan.id).toBe('cheap');
  });

  it('sends a spare ₹5,000 to the balance that avoids more interest', () => {
    const shared = { createdAt: today, lastAccrualDate: today, dueDay: 8 };
    const low = loan({
      id: 'low',
      name: 'Low',
      annualRate: 10,
      interestOnly: true,
      type: 'gold',
      emiAmount: null,
      endDate: '2027-09-28',
      ...shared,
    });
    const high = loan({
      id: 'high',
      name: 'High',
      annualRate: 20,
      interestOnly: true,
      type: 'other',
      emiAmount: null,
      endDate: '2027-09-28',
      ...shared,
    });
    const advice = advise([low, high], [], today);
    expect(advice?.kind).toBe('reduce');
    expect(advice?.loan.id).toBe('high');
    expect(advice?.interestSaved ?? 0).toBeGreaterThan(advice?.alternative?.interestSaved ?? 0);
  });

  it('moves the due forward after the installment is paid', () => {
    const sample = loan({ id: 'paid', dueDay: 27, emiAmount: 100_000, outstanding: 9_900_000 });
    const payments: Payment[] = [
      {
        id: 'p',
        loanId: 'paid',
        userId: 'u',
        amount: 100_000,
        paidOn: '2026-09-27',
        note: '',
        interestPortion: 0,
        principalPortion: 100_000,
        interestSaved: 0,
        balanceAfter: 9_800_000,
        createdAt: '2026-09-27',
      },
    ];
    const due = dueInfo(sample, payments, today);
    expect(due?.state).toBe('upcoming');
    expect(due?.date).toBe('2026-10-27');
  });
});

describe('sample desk', () => {
  it('builds a ledger whose best move is an extra payment', () => {
    const demo = buildDemo({
      userId: 'user_demo',
      name: 'Meera Shah',
      email: 'meera@moneyres.app',
      passwordHash: 'x',
      passwordSalt: 'y',
      today,
    });
    expect(demo.loans).toHaveLength(5);
    expect(demo.payments.some((payment) => payment.interestSaved > 0)).toBe(true);
    const advice = advise(demo.loans, demo.payments, today);
    expect(advice?.kind).toBe('reduce');
    expect(advice?.higherRate?.loan.type).toBe('credit_card');
  });
});
