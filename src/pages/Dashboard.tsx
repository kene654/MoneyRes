import { Link } from 'react-router-dom';
import { Meter, PageHead, Ring } from '../components/ui';
import { duePhrase } from '../domain/dues';
import { formatDayMonth, formatDate, greeting, todayISO } from '../domain/dates';
import { buildDashboard, goalsWithProgress } from '../domain/metrics';
import { formatINR, formatRate, paiseToInput } from '../domain/money';
import { advise, type Advice } from '../domain/suggestions';
import { loanTypeLabel } from '../domain/types';
import { useLedger } from '../state/store';

export function DashboardPage() {
  const { user, loans, payments, goals, contributions } = useLedger();
  const today = todayISO();
  const model = buildDashboard(loans, payments, user?.income?.monthlyAmount ?? null, today);
  const advice = advise(loans, payments, today);
  const goalRows = goalsWithProgress(goals, contributions).slice(0, 2);
  const cleared = Math.round(model.clearedRatio * 100);
  const first = user?.name.split(' ')[0] ?? '';

  return (
    <div className="page">
      <PageHead
        kicker={`${greeting()} · ${formatDate(today)}`}
        title={first ? `${first}'s desk` : 'Your desk'}
        lede={
          model.activeCount === 0
            ? 'Add the loan that costs you the most. Artha will tell you when an extra payment is worth it.'
            : `${model.activeCount} open ${model.activeCount === 1 ? 'balance' : 'balances'}.`
        }
      >
        <Link className="btn btn-primary" to="/loans/new">
          Add a loan
        </Link>
      </PageHead>

      <section className={model.activeCount > 0 ? 'hero snapshot' : 'hero'}>
        <div className="snapshot-main">
          <div>
            <p className="kicker">Still with lenders</p>
            <p className="hero-num">{formatINR(model.totalOutstanding)}</p>
          </div>
          <p className="lede snapshot-foot">
            {model.interestSaved > 0
              ? `${formatINR(model.interestSaved)} interest already avoided`
              : 'Extra payments show up here as interest you no longer have to pay.'}
          </p>
        </div>
        {model.activeCount > 0 ? (
          <div className="snapshot-metrics">
            <Ring value={model.clearedRatio} label={`${cleared}%`} />
            <div className="cleared-copy">
              <strong>Term loans cleared</strong>
              <span>
                {model.termPrincipal > 0
                  ? `${formatINR(model.clearedAmount)} of ${formatINR(model.termPrincipal)}`
                  : 'No term loan on the desk'}
              </span>
            </div>
            <div className="metric-grid">
              <div className="metric">
                <span>Interest ahead</span>
                <strong>{formatINR(model.remainingInterest)}</strong>
                <small>On the regular schedule</small>
              </div>
              <div className={`metric${model.incomeShare != null && model.incomeShare > 0.5 ? ' hot' : ''}`}>
                <span>This cycle</span>
                <strong>{formatINR(model.monthlyCommitment)}</strong>
                <small>
                  {model.incomeShare == null
                    ? 'Set income to compare with pay'
                    : `${Math.round(model.incomeShare * 100)}% of income`}
                </small>
              </div>
              <div className="metric">
                <span>Blended rate</span>
                <strong>{model.blendedRate == null ? '—' : formatRate(model.blendedRate)}</strong>
                <small>{formatINR(model.interestPaid)} interest paid</small>
              </div>
              <div className="metric">
                <span>Cards</span>
                <strong>{formatINR(model.cardBalance)}</strong>
                <small>
                  {model.cardLimit > 0
                    ? `${Math.round((model.cardBalance / model.cardLimit) * 100)}% of ${formatINR(model.cardLimit)}`
                    : 'No limit entered'}
                </small>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="split">
        <article className="suggest">
          {advice ? <PayCard advice={advice} /> : (
            <>
              <div className="suggest-top">
                <div>
                  <p className="kicker">Pay this today</p>
                  <h2>Nothing to aim at yet</h2>
                </div>
                <Link className="btn btn-primary" to="/loans/new">Add a loan</Link>
              </div>
              <p className="suggest-lead">Add a loan and Artha will compare an extra ₹5,000 across all of them.</p>
            </>
          )}
        </article>
        <article className="panel">
          <p className="kicker">Next dues</p>
          {model.dues.length === 0 ? (
            <p className="empty-copy">Due dates appear here after you add a loan.</p>
          ) : (
            <ul className="due-list">
              {model.dues.slice(0, 5).map((row) => {
                const stamp = formatDayMonth(row.due.date);
                return (
                  <li key={row.loan.id}>
                    <Link to={`/loans/${row.loan.id}`} className="due-row">
                      <span className="date-stack">
                        <strong>{stamp.day}</strong>
                        <small>{stamp.month}</small>
                      </span>
                      <span>
                        <strong>{row.loan.name}</strong>
                        <small>
                          {loanTypeLabel(row.loan.type)} · {duePhrase(row.due)}
                        </small>
                      </span>
                      <em>{formatINR(row.amount)}</em>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </section>

      {model.byType.length > 0 || goalRows.length > 0 ? (
        <section className={model.byType.length > 0 && goalRows.length > 0 ? 'split' : 'stack'}>
          {model.byType.length > 0 ? (
            <article className="panel">
              <p className="kicker">Where the balance sits</p>
              <div className="bars">
                {model.byType.map((slice) => (
                  <div key={slice.type} className="bar-row">
                    <div>
                      <strong>{loanTypeLabel(slice.type)}</strong>
                      <small>
                        {slice.count} · {formatINR(slice.outstanding)}
                      </small>
                    </div>
                    <Meter value={slice.share} tone={slice.type === 'credit_card' ? 'clay' : 'gold'} />
                  </div>
                ))}
              </div>
            </article>
          ) : null}
          {goalRows.length > 0 ? (
            <div className={model.byType.length > 0 ? 'goal-stack' : 'goal-strip'}>
              {goalRows.map(({ goal, saved, ratio }) => (
                <Link key={goal.id} to={`/goals/${goal.id}`} className="goal-card">
                  <div className="goal-copy">
                    <p className="kicker">Goal</p>
                    <h3>{goal.name}</h3>
                    <small>
                      {formatINR(saved)} of {formatINR(goal.targetAmount)}
                    </small>
                  </div>
                  <Meter value={ratio} tone="sage" />
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function PayCard({ advice }: { advice: Advice }) {
  const payLink = (
    <Link className="btn btn-primary" to={`/loans/${advice.loan.id}?pay=${paiseToInput(advice.amount)}`}>
      Record {formatINR(advice.amount)}
    </Link>
  );
  const title = advice.kind === 'reduce' ? 'Pay this today' : advice.kind === 'trap' ? 'Balance is growing' : 'Due now';

  if (advice.kind !== 'reduce') {
    return (
      <>
        <div className="suggest-top">
          <div>
            <p className="kicker">{title}</p>
            <h2>{advice.loan.name}</h2>
          </div>
          {payLink}
        </div>
        <p className="suggest-lead">
          {advice.kind === 'protect' && advice.due
            ? `${duePhrase(advice.due)}. Pay this before fees and extra interest start.`
            : `${formatRate(advice.loan.annualRate)} interest is not covered by the usual payment. This amount starts reducing the balance.`}
        </p>
      </>
    );
  }

  const others = [
    advice.alternative ? { loan: advice.alternative.loan, saved: advice.alternative.interestSaved } : null,
    advice.higherRate ? { loan: advice.higherRate.loan, saved: advice.higherRate.interestSaved } : null,
  ].filter((row): row is { loan: Advice['loan']; saved: number } => row !== null);

  return (
    <>
      <div className="suggest-top">
        <div>
          <p className="kicker">{title}</p>
          <h2>{advice.loan.name}</h2>
        </div>
        {payLink}
      </div>
      <p className="suggest-save">
        <strong>{formatINR(advice.interestSaved)}</strong>
        <span>
          interest avoided with {formatINR(advice.extra)} extra · {formatRate(advice.loan.annualRate)}
        </span>
      </p>
      {others.length > 0 ? (
        <ul className="compare">
          {others.map((row) => (
            <li key={row.loan.id}>
              <span>{row.loan.name}</span>
              <small>{formatRate(row.loan.annualRate)}</small>
              <strong>{formatINR(row.saved)}</strong>
            </li>
          ))}
        </ul>
      ) : null}
      {advice.higherRate ? (
        <p className="suggest-note">{advice.higherRate.loan.name} charges more, and is paid off sooner.</p>
      ) : null}
    </>
  );
}
