import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorNote } from '../components/ui';
import type { IncomeKind } from '../domain/types';
import { parseRupees, rupeesToPaise } from '../domain/money';
import { saveIncome } from '../state/store';

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<IncomeKind>('employed');
  const [amount, setAmount] = useState('');
  const [payDay, setPayDay] = useState('1');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');

  function finish() {
    const rupees = parseRupees(amount);
    const day = Number(payDay);
    if (rupees == null || rupees <= 0) {
      setError(type === 'employed' ? 'Enter your monthly salary.' : 'Enter a typical month of income.');
      return;
    }
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      setError('Choose a day from 1 to 31.');
      return;
    }
    const result = saveIncome(
      {
        type,
        monthlyAmount: rupeesToPaise(rupees),
        payDay: day,
        source: source.trim(),
      },
      true,
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate('/');
  }

  return (
    <div className="onboard">
      <div className="onboard-card">
        <p className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Artha
        </p>
        <p className="kicker">Step {step} of 2</p>
        {step === 1 ? (
          <>
            <h1>How does money arrive?</h1>
            <p className="lede">This sets the income Artha compares with your EMIs. You can change it later.</p>
            <div className="choice-grid">
              <button type="button" className={`choice${type === 'employed' ? ' selected' : ''}`} onClick={() => setType('employed')}>
                <strong>Employed</strong>
                <span>A salary that lands on a set day.</span>
              </button>
              <button type="button" className={`choice${type === 'self' ? ' selected' : ''}`} onClick={() => setType('self')}>
                <strong>Self-employed</strong>
                <span>Income that varies, with a usual day.</span>
              </button>
            </div>
            <button className="btn btn-primary" type="button" onClick={() => setStep(2)}>
              Continue
            </button>
          </>
        ) : (
          <>
            <h1>{type === 'employed' ? 'Your salary' : 'A typical month'}</h1>
            <p className="lede">
              {type === 'employed'
                ? 'Artha uses this to show how much of your pay the loans take.'
                : 'Use a normal month, not your best one. You can correct it any time.'}
            </p>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <label className="field">
              <span>{type === 'employed' ? 'Monthly salary' : 'Typical monthly income'}</span>
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="85000" />
            </label>
            <label className="field">
              <span>{type === 'employed' ? 'Salary date' : 'Day it usually arrives'}</span>
              <input inputMode="numeric" value={payDay} onChange={(event) => setPayDay(event.target.value)} />
            </label>
            <label className="field">
              <span>{type === 'employed' ? 'Employer' : 'Source'}</span>
              <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Optional" />
            </label>
            <div className="row-actions">
              <button className="btn btn-ghost" type="button" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn btn-primary" type="button" onClick={finish}>
                Open my desk
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
