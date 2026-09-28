import { useState } from 'react';
import type { IncomeKind } from '../domain/types';
import { formatINR, paiseToInput, parseRupees, rupeesToPaise } from '../domain/money';
import { saveIncome, useLedger } from '../state/store';
import { ErrorNote } from './ui';

export function IncomeEditor() {
  const { user } = useLedger();
  const income = user?.income;
  const [type, setType] = useState<IncomeKind>(income?.type ?? 'employed');
  const [amount, setAmount] = useState(income ? paiseToInput(income.monthlyAmount) : '');
  const [payDay, setPayDay] = useState(income ? String(income.payDay) : '1');
  const [source, setSource] = useState(income?.source ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function save() {
    const rupees = parseRupees(amount);
    const day = Number(payDay);
    if (rupees == null || rupees <= 0) {
      setError('Enter the monthly amount.');
      setMessage('');
      return;
    }
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      setError('The day should be from 1 to 31.');
      setMessage('');
      return;
    }
    const result = saveIncome(
      { type, monthlyAmount: rupeesToPaise(rupees), payDay: day, source: source.trim() },
      false,
    );
    if (!result.ok) {
      setError(result.error);
      setMessage('');
      return;
    }
    setError('');
    setMessage('Income updated.');
  }

  return (
    <section className="panel income-editor">
      <div>
        <p className="kicker">{type === 'employed' ? 'Employed' : 'Self-employed'}</p>
        <h2>{income ? `${formatINR(income.monthlyAmount)} a month` : 'Set your income'}</h2>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="chips">
        <button type="button" className={`chip${type === 'employed' ? ' selected' : ''}`} onClick={() => setType('employed')}>
          Employed
        </button>
        <button type="button" className={`chip${type === 'self' ? ' selected' : ''}`} onClick={() => setType('self')}>
          Self-employed
        </button>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>{type === 'employed' ? 'Monthly salary' : 'Typical monthly income'}</span>
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label className="field">
          <span>{type === 'employed' ? 'Salary date' : 'Usual day'}</span>
          <input inputMode="numeric" value={payDay} onChange={(event) => setPayDay(event.target.value)} />
        </label>
        <label className="field">
          <span>{type === 'employed' ? 'Employer' : 'Source'}</span>
          <input value={source} onChange={(event) => setSource(event.target.value)} />
        </label>
      </div>
      <div className="row-actions">
        <button className="btn btn-primary" type="button" onClick={save}>
          Save income
        </button>
        {message ? <span className="fine">{message}</span> : null}
      </div>
    </section>
  );
}
