import { useState, type FormEvent } from 'react';
import { ErrorNote, PageHead } from '../components/ui';
import { IncomeEditor } from '../components/IncomeEditor';
import { formatDate, monthKey, monthLabel, shiftMonth, todayISO } from '../domain/dates';
import { monthEntries, sumKind } from '../domain/metrics';
import { scheduledMonthlyPayment } from '../domain/loanEngine';
import { formatINR, parseRupees } from '../domain/money';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../domain/types';
import { addEntry, deleteEntry, useLedger } from '../state/store';

export function CashflowPage() {
  const { user, entries, loans } = useLedger();
  const today = todayISO();
  const [month, setMonth] = useState(monthKey(today));
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const logged = monthEntries(entries, month);
  const incomeLogged = sumKind(logged, 'income');
  const expenseLogged = sumKind(logged, 'expense');
  const emis = loans
    .filter((loan) => loan.status === 'active')
    .reduce((sum, loan) => sum + scheduledMonthlyPayment(loan, today), 0);
  const plannedIncome = user?.income?.monthlyAmount ?? 0;
  const left = plannedIncome - expenseLogged - emis;
  const categories = kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  function onKind(next: 'expense' | 'income') {
    setKind(next);
    setCategory(next === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const rupees = parseRupees(amount);
    if (rupees == null) {
      setError('Enter an amount.');
      return;
    }
    const result = addEntry({ kind, category, amountRupees: rupees, occurredOn: date, note });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAmount('');
    setNote('');
    setError('');
    setMonth(monthKey(date));
  }

  return (
    <div className="page">
      <PageHead
        kicker="Income and expenses"
        title="What the month can hold"
        lede="Salary is the plan. Expenses are what you log. Loan dues come from the loans themselves."
      />
      <IncomeEditor />
      <section className="stat-grid">
        <article className="stat">
          <span>Planned income</span>
          <strong>{formatINR(plannedIncome)}</strong>
          <small>{user?.income ? `Arrives around the ${user.income.payDay}` : 'Set this above'}</small>
        </article>
        <article className="stat">
          <span>Logged expenses</span>
          <strong>{formatINR(expenseLogged)}</strong>
          <small>{monthLabel(month)}</small>
        </article>
        <article className="stat">
          <span>Loan dues</span>
          <strong>{formatINR(emis)}</strong>
          <small>Regular payments on open loans</small>
        </article>
        <article className={`stat${left < 0 ? ' hot' : ''}`}>
          <span>Left in the plan</span>
          <strong>{formatINR(left)}</strong>
          <small>Income, minus logged expenses and loan dues</small>
        </article>
      </section>
      <section className="split">
        <form className="panel stack" onSubmit={onSubmit}>
          <p className="kicker">Add an entry</p>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <div className="chips">
            <button type="button" className={`chip${kind === 'expense' ? ' selected' : ''}`} onClick={() => onKind('expense')}>
              Expense
            </button>
            <button type="button" className={`chip${kind === 'income' ? ' selected' : ''}`} onClick={() => onKind('income')}>
              Income
            </button>
          </div>
          <label className="field">
            <span>Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Amount</span>
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="field">
            <span>Note</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button className="btn btn-primary" type="submit">
            Add {kind}
          </button>
        </form>
        <section className="panel">
          <div className="month-switch">
            <button className="btn btn-ghost" type="button" onClick={() => setMonth(shiftMonth(month, -1))}>
              Previous
            </button>
            <strong>{monthLabel(month)}</strong>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              disabled={month >= monthKey(today)}
            >
              Next
            </button>
          </div>
          <p className="fine">Logged income this month: {formatINR(incomeLogged)}</p>
          {logged.length === 0 ? (
            <p className="empty-copy">Nothing logged in {monthLabel(month)}.</p>
          ) : (
            <ul className="history">
              {logged.map((entry) => (
                <li key={entry.id} className={`history-row ${entry.kind}`}>
                  <span>
                    <strong>{entry.category}</strong>
                    <small>
                      {formatDate(entry.occurredOn)}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </small>
                  </span>
                  <em>
                    {entry.kind === 'expense' ? '−' : '+'}
                    {formatINR(entry.amount)}
                  </em>
                  <button className="text-btn" type="button" onClick={() => deleteEntry(entry.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </div>
  );
}
