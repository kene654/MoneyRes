import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Meter, PageHead } from '../components/ui';
import { dueInfo, duePhrase } from '../domain/dues';
import { todayISO, formatDate } from '../domain/dates';
import { loanInsight } from '../domain/metrics';
import { scheduledMonthlyPayment } from '../domain/loanEngine';
import { formatINR, formatRate } from '../domain/money';
import { LOAN_TYPES, loanTypeLabel, type LoanType } from '../domain/types';
import { useLedger } from '../state/store';

export function LoansPage() {
  const { loans, payments } = useLedger();
  const [filter, setFilter] = useState<LoanType | 'all'>('all');
  const today = todayISO();
  const visible = useMemo(() => {
    const rows = loans
      .filter((loan) => (filter === 'all' ? true : loan.type === filter))
      .map((loan) => ({
        loan,
        due: dueInfo(loan, payments, today),
        insight: loanInsight(loan, payments, today),
        monthly: scheduledMonthlyPayment(loan, today),
      }));
    return rows.sort((a, b) => {
      if (a.loan.status !== b.loan.status) return a.loan.status === 'active' ? -1 : 1;
      return (a.due?.date ?? '9999').localeCompare(b.due?.date ?? '9999');
    });
  }, [filter, loans, payments, today]);

  const open = visible.filter((row) => row.loan.status === 'active');
  const settled = visible.filter((row) => row.loan.status === 'closed');

  return (
    <div className="page">
      <PageHead
        kicker="Loans"
        title="Everything you owe"
        lede="EMIs, gold, vehicles, home, and cards. Open one to record a payment and see the interest it avoids."
      >
        <Link className="btn btn-primary" to="/loans/new">
          Add a loan
        </Link>
      </PageHead>
      <div className="chips" role="tablist" aria-label="Loan types">
        <button type="button" className={`chip${filter === 'all' ? ' selected' : ''}`} onClick={() => setFilter('all')}>
          All
        </button>
        {LOAN_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            className={`chip${filter === type.id ? ' selected' : ''}`}
            onClick={() => setFilter(type.id)}
          >
            {type.label}
          </button>
        ))}
      </div>
      {open.length === 0 && settled.length === 0 ? (
        <div className="empty">
          <h2>No loans in this view</h2>
          <p>Add a home loan, a card, or the EMI that bothers you most. The desk gets useful with the first one.</p>
        </div>
      ) : (
        <div className="loan-grid">
          {open.map(({ loan, due, insight, monthly }) => (
            <Link key={loan.id} to={`/loans/${loan.id}`} className={`loan-card type-${loan.type}`}>
              <div className="loan-top">
                <span className="type-pill">{loanTypeLabel(loan.type)}</span>
                {due ? <span className={`due-chip ${due.state}`}>{duePhrase(due)}</span> : null}
              </div>
              <h2>{loan.name}</h2>
              <p className="lender">{loan.lender || 'Lender not set'}</p>
              <p className="owe">
                <small>{loan.type === 'credit_card' ? 'Balance' : 'Still owed'}</small>
                {formatINR(loan.outstanding)}
              </p>
              <Meter
                value={loan.type === 'credit_card' ? (insight.utilization ?? 0) : insight.completion}
                tone={loan.type === 'credit_card' ? 'clay' : 'gold'}
              />
              <p className="loan-meta">
                <span>{formatRate(loan.annualRate)}</span>
                <span>{loan.interestOnly ? 'Interest only' : `EMI ${formatINR(monthly)}`}</span>
                {loan.endDate ? <span>Ends {formatDate(loan.endDate)}</span> : null}
              </p>
              {insight.interestSaved > 0 ? <p className="saved-line">{formatINR(insight.interestSaved)} interest avoided</p> : null}
            </Link>
          ))}
        </div>
      )}
      {settled.length > 0 ? (
        <section className="panel settled">
          <p className="kicker">Settled</p>
          <ul className="plain-list">
            {settled.map(({ loan, insight }) => (
              <li key={loan.id}>
                <Link to={`/loans/${loan.id}`}>
                  <strong>{loan.name}</strong>
                  <span>
                    Interest paid {formatINR(insight.interestPaid)}
                    {insight.interestSaved > 0 ? ` · avoided ${formatINR(insight.interestSaved)}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
