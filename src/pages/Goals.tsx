import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ErrorNote, Meter, PageHead } from '../components/ui';
import { formatDate, todayISO } from '../domain/dates';
import { goalsWithProgress } from '../domain/metrics';
import { formatINR, parseRupees } from '../domain/money';
import { saveGoal, useLedger } from '../state/store';

export function GoalsPage() {
  const { goals, contributions } = useLedger();
  const rows = goalsWithProgress(goals, contributions);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const rupees = parseRupees(target);
    if (rupees == null) {
      setError('Enter the amount you want to reach.');
      return;
    }
    const result = saveGoal({ name, targetRupees: rupees, targetDate: date || null, note });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName('');
    setTarget('');
    setDate('');
    setNote('');
    setOpen(false);
    setError('');
  }

  return (
    <div className="page">
      <PageHead
        kicker="Goals"
        title="Money with a job"
        lede="A goal is cash you are keeping away from the next impulse — and away from interest."
      >
        <button className="btn btn-primary" type="button" onClick={() => setOpen((value) => !value)}>
          {open ? 'Close' : 'New goal'}
        </button>
      </PageHead>
      {open ? (
        <form className="panel stack" onSubmit={onSubmit}>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Emergency fund" />
            </label>
            <label className="field">
              <span>Target</span>
              <input inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} />
            </label>
            <label className="field">
              <span>Reach it by</span>
              <input type="date" value={date} min={todayISO()} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="field">
              <span>Note</span>
              <input value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
          </div>
          <button className="btn btn-primary" type="submit">
            Create goal
          </button>
        </form>
      ) : null}
      {rows.length === 0 ? (
        <div className="empty">
          <h2>No goals yet</h2>
          <p>Start with an emergency fund. Even a small target gives surplus money a place to land.</p>
        </div>
      ) : (
        <div className="goal-grid">
          {rows.map(({ goal, saved, ratio }) => (
            <Link key={goal.id} to={`/goals/${goal.id}`} className="goal-card">
              <h2>{goal.name}</h2>
              <Meter value={ratio} tone="sage" />
              <p className="owe">
                <small>
                  {formatINR(saved)} of {formatINR(goal.targetAmount)}
                </small>
                {Math.round(ratio * 100)}%
              </p>
              {goal.targetDate ? <small>By {formatDate(goal.targetDate)}</small> : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
