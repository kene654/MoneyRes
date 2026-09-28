import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorNote, Meter, PageHead } from '../components/ui';
import { formatDate, monthsBetween, todayISO } from '../domain/dates';
import { goalSaved } from '../domain/metrics';
import { formatINR, paiseToInput, parseRupees } from '../domain/money';
import { addContribution, deleteGoal, saveGoal, useLedger } from '../state/store';

export function GoalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { goals, contributions } = useLedger();
  const goal = goals.find((item) => item.id === id);
  const today = todayISO();
  const saved = goal ? goalSaved(goal.id, contributions) : 0;
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? paiseToInput(goal.targetAmount) : '');
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [goalNote, setGoalNote] = useState(goal?.note ?? '');
  const [confirming, setConfirming] = useState(false);

  const mine = useMemo(
    () =>
      contributions
        .filter((item) => item.goalId === id)
        .sort((a, b) => b.contributedOn.localeCompare(a.contributedOn)),
    [contributions, id],
  );

  if (!goal) {
    return (
      <div className="page narrow">
        <PageHead title="Goal not found" />
        <Link className="btn btn-ghost" to="/goals">
          Back to goals
        </Link>
      </div>
    );
  }

  const current = goal;
  const ratio = current.targetAmount > 0 ? Math.min(1, saved / current.targetAmount) : 0;
  const remaining = Math.max(0, current.targetAmount - saved);
  const months = current.targetDate ? monthsBetween(today, current.targetDate) : 0;
  const pace = months > 0 ? Math.ceil(remaining / months) : 0;

  function onAdd(event: FormEvent) {
    event.preventDefault();
    const rupees = parseRupees(amount);
    if (rupees == null) {
      setError('Enter how much you set aside.');
      return;
    }
    const result = addContribution(current.id, { amountRupees: rupees, contributedOn: date, note });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAmount('');
    setNote('');
    setError('');
  }

  function onSave(event: FormEvent) {
    event.preventDefault();
    const rupees = parseRupees(target);
    if (rupees == null) {
      setError('Enter the target amount.');
      return;
    }
    const result = saveGoal({
      id: current.id,
      name,
      targetRupees: rupees,
      targetDate: targetDate || null,
      note: goalNote,
    });
    if (!result.ok) setError(result.error);
    else setError('');
  }

  function onDelete() {
    deleteGoal(current.id);
    navigate('/goals');
  }

  return (
    <div className="page">
      <PageHead kicker="Goal" title={current.name} lede={current.note || 'Savings set aside for this goal.'}>
        <Link className="btn btn-ghost" to="/goals">
          All goals
        </Link>
      </PageHead>
      <section className="hero compact">
        <div>
          <p className="kicker">Set aside</p>
          <p className="hero-num">{formatINR(saved)}</p>
          <p className="lede">
            of {formatINR(current.targetAmount)}
            {current.targetDate ? ` by ${formatDate(current.targetDate)}` : ''}
          </p>
        </div>
        <div className="hero-side">
          <Meter value={ratio} tone="sage" />
          <small>
            {pace > 0 && remaining > 0
              ? `${formatINR(pace)} a month reaches it on time.`
              : remaining === 0
                ? 'This goal is funded.'
                : 'Add a date if you want a monthly pace.'}
          </small>
        </div>
      </section>
      <section className="split">
        <form className="panel stack" onSubmit={onAdd}>
          <p className="kicker">Add savings</p>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
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
            Add to the goal
          </button>
        </form>
        <form className="panel stack" onSubmit={onSave}>
          <p className="kicker">Edit goal</p>
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field">
            <span>Target</span>
            <input inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} />
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
          </label>
          <label className="field">
            <span>Note</span>
            <input value={goalNote} onChange={(event) => setGoalNote(event.target.value)} />
          </label>
          <button className="btn btn-ghost" type="submit">
            Save goal
          </button>
        </form>
      </section>
      <section className="panel">
        <p className="kicker">Contributions</p>
        {mine.length === 0 ? (
          <p className="empty-copy">Nothing set aside yet.</p>
        ) : (
          <ul className="history">
            {mine.map((item) => (
              <li key={item.id} className="history-row">
                <span>
                  <strong>{item.note || 'Saved'}</strong>
                  <small>{formatDate(item.contributedOn)}</small>
                </span>
                <em>{formatINR(item.amount)}</em>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="confirm-row">
        {confirming ? (
          <>
            <span>Remove this goal?</span>
            <button className="btn btn-danger" type="button" onClick={onDelete}>
              Remove
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button className="btn btn-ghost" type="button" onClick={() => setConfirming(true)}>
            Remove goal
          </button>
        )}
      </div>
    </div>
  );
}
