import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorNote, Field, PageHead } from '../components/ui';
import { monthsBetween, todayISO } from '../domain/dates';
import { calcEmi } from '../domain/loanEngine';
import { formatINR, paiseToInput, parseRupees } from '../domain/money';
import { LOAN_TYPES, type LoanType } from '../domain/types';
import { saveLoan, useLedger, type LoanDraft } from '../state/store';

export function LoanFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { loans } = useLedger();
  const existing = loans.find((loan) => loan.id === id);
  const today = todayISO();

  const [type, setType] = useState<LoanType>(existing?.type ?? 'home');
  const [name, setName] = useState(existing?.name ?? '');
  const [lender, setLender] = useState(existing?.lender ?? '');
  const [principal, setPrincipal] = useState(existing ? paiseToInput(existing.principal) : '');
  const [outstanding, setOutstanding] = useState(existing ? paiseToInput(existing.outstanding) : '');
  const [rate, setRate] = useState(existing ? String(existing.annualRate) : '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [emi, setEmi] = useState(existing?.emiAmount ? paiseToInput(existing.emiAmount) : '');
  const [dueDay, setDueDay] = useState(existing?.dueDay ? String(existing.dueDay) : '');
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const [limit, setLimit] = useState(existing?.creditLimit ? paiseToInput(existing.creditLimit) : '');
  const [interestOnly, setInterestOnly] = useState(existing?.interestOnly ?? false);
  const [error, setError] = useState('');

  const isCard = type === 'credit_card';
  const suggestedEmi = useMemo(() => {
    if (isCard || interestOnly) return null;
    const owed = parseRupees(outstanding);
    const annual = Number(rate);
    if (owed == null || owed <= 0 || !endDate || !Number.isFinite(annual)) return null;
    const months = monthsBetween(startDate || today, endDate);
    if (months <= 0) return null;
    return calcEmi(Math.round(owed * 100), annual, months);
  }, [endDate, interestOnly, isCard, outstanding, rate, startDate, today]);

  function chooseType(next: LoanType) {
    setType(next);
    if (next === 'gold') setInterestOnly(true);
    if (next === 'home' || next === 'vehicle' || next === 'emi' || next === 'credit_card') setInterestOnly(false);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const owed = parseRupees(outstanding);
    const annual = Number(rate);
    const day = Number(dueDay);
    const original = parseRupees(principal);
    const emiValue = parseRupees(emi);
    const limitValue = parseRupees(limit);
    if (owed == null) {
      setError('Enter the amount still owed.');
      return;
    }
    if (!Number.isFinite(annual)) {
      setError('Enter the yearly interest rate.');
      return;
    }
    const draft: LoanDraft = {
      name,
      lender,
      type,
      principalRupees: isCard ? owed : (original ?? owed),
      outstandingRupees: owed,
      annualRate: annual,
      startDate,
      emiRupees: !interestOnly && emiValue ? emiValue : null,
      dueDay: Number.isInteger(day) ? day : null,
      endDate: endDate || null,
      creditLimitRupees: isCard ? limitValue : null,
      interestOnly,
    };
    const result = saveLoan(draft, existing?.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate(`/loans/${result.data?.id ?? ''}`);
  }

  return (
    <div className="page narrow">
      <PageHead
        kicker={existing ? 'Edit loan' : 'New loan'}
        title={existing ? existing.name : 'Add what you owe'}
        lede="The balance you enter is what you owe today. Interest starts counting from this moment."
      />
      <form className="stack" onSubmit={onSubmit}>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <div className="type-picker">
          {LOAN_TYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`type-option${type === item.id ? ' selected' : ''}`}
              onClick={() => chooseType(item.id)}
            >
              <strong>{item.label}</strong>
              <span>{item.blurb}</span>
            </button>
          ))}
        </div>
        <div className="form-grid">
          <Field label="Name">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="SBI home loan" required />
          </Field>
          <Field label="Lender">
            <input value={lender} onChange={(event) => setLender(event.target.value)} placeholder="SBI, HDFC, Muthoot" />
          </Field>
          <Field label={isCard ? 'Current balance' : 'Still owed today'}>
            <input inputMode="decimal" value={outstanding} onChange={(event) => setOutstanding(event.target.value)} required />
          </Field>
          {isCard ? (
            <Field label="Credit limit" hint="Optional. Used to show how full the card is.">
              <input inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value)} />
            </Field>
          ) : (
            <Field label="Originally borrowed" hint="Leave blank if it is the same as what you owe now.">
              <input inputMode="decimal" value={principal} onChange={(event) => setPrincipal(event.target.value)} />
            </Field>
          )}
          <Field label="Interest, percent a year">
            <input inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="8.5" required />
          </Field>
          <Field label="Due day" hint="The day of each month this is payable.">
            <input inputMode="numeric" value={dueDay} onChange={(event) => setDueDay(event.target.value)} placeholder="5" required />
          </Field>
          <Field label="Started">
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
          </Field>
          <Field label={isCard ? 'Want it cleared by' : interestOnly ? 'Principal due back' : 'Completion date'}>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </Field>
        </div>
        {!isCard ? (
          <label className="check">
            <input
              type="checkbox"
              checked={interestOnly}
              onChange={(event) => setInterestOnly(event.target.checked)}
            />
            <span>I pay the interest each month and return the full amount at the end.</span>
          </label>
        ) : null}
        {!interestOnly ? (
          <Field
            label={isCard ? 'Usual monthly payment' : 'EMI'}
            hint={
              suggestedEmi
                ? `A full EMI on these numbers would be about ${formatINR(suggestedEmi)}.`
                : isCard
                  ? 'What you usually send. Artha uses it to judge an extra payment.'
                  : 'Leave this blank if you only know the end date.'
            }
          >
            <input inputMode="decimal" value={emi} onChange={(event) => setEmi(event.target.value)} />
          </Field>
        ) : null}
        {suggestedEmi && !emi ? (
          <button className="btn btn-ghost" type="button" onClick={() => setEmi(paiseToInput(suggestedEmi))}>
            Use {formatINR(suggestedEmi)} as the EMI
          </button>
        ) : null}
        <div className="row-actions">
          <Link className="btn btn-ghost" to={existing ? `/loans/${existing.id}` : '/loans'}>
            Cancel
          </Link>
          <button className="btn btn-primary" type="submit">
            {existing ? 'Save changes' : 'Add loan'}
          </button>
        </div>
      </form>
    </div>
  );
}
