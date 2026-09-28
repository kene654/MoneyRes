import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ErrorNote, Meter, PageHead } from '../components/ui';
import { dueInfo, duePhrase } from '../domain/dues';
import { formatDate, todayISO } from '../domain/dates';
import { loanInsight } from '../domain/metrics';
import { quotePayment, scheduledMonthlyPayment } from '../domain/loanEngine';
import { formatINR, formatRate, parseRupees, rupeesToPaise } from '../domain/money';
import { loanTypeLabel } from '../domain/types';
import { deleteLoan, recordPayment, recordSpend, useLedger } from '../state/store';
import type { Payment } from '../domain/types';

export function LoanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { loans, payments, spends } = useLedger();
  const loan = loans.find((item) => item.id === id);
  const today = todayISO();
  const prefill = params.get('pay') ?? '';
  const [amount, setAmount] = useState(prefill);
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const [spendAmount, setSpendAmount] = useState('');
  const [spendDate, setSpendDate] = useState(today);
  const [spendNote, setSpendNote] = useState('');

  const quote = useMemo(() => {
    if (!loan) return null;
    const rupees = parseRupees(amount);
    if (rupees == null || rupees <= 0) return null;
    return quotePayment(loan, rupeesToPaise(rupees), paidOn, today);
  }, [amount, loan, paidOn, today]);

  if (!loan) {
    return (
      <div className="page narrow">
        <PageHead title="Loan not found" lede="It may have been removed from this desk." />
        <Link className="btn btn-ghost" to="/loans">
          Back to loans
        </Link>
      </div>
    );
  }

  const insight = loanInsight(loan, payments, today);
  const due = dueInfo(loan, payments, today);
  const monthly = scheduledMonthlyPayment(loan, today);
  const history = [
    ...payments
      .filter((payment) => payment.loanId === loan.id)
      .map((payment) => ({
        id: payment.id,
        date: payment.paidOn,
        title: 'Payment',
        amount: payment.amount,
        detail:
          payment.interestSaved > 0
            ? `${formatINR(payment.principalPortion)} to principal · avoided ${formatINR(payment.interestSaved)}`
            : `${formatINR(payment.interestPortion)} interest · ${formatINR(payment.principalPortion)} principal`,
      })),
    ...spends
      .filter((spend) => spend.loanId === loan.id)
      .map((spend) => ({
        id: spend.id,
        date: spend.spentOn,
        title: 'Card spend',
        amount: spend.amount,
        detail: spend.note || 'Added to the balance',
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const active = loan;

  function onPay(event: FormEvent) {
    event.preventDefault();
    const rupees = parseRupees(amount);
    if (rupees == null) {
      setError('Enter the amount you paid.');
      return;
    }
    const result = recordPayment(active.id, { amountRupees: rupees, paidOn, note });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReceipt(result.data ?? null);
    setError('');
    setAmount('');
    setNote('');
  }

  function onSpend(event: FormEvent) {
    event.preventDefault();
    const rupees = parseRupees(spendAmount);
    if (rupees == null) {
      setError('Enter the spend.');
      return;
    }
    const result = recordSpend(active.id, { amountRupees: rupees, spentOn: spendDate, note: spendNote });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSpendAmount('');
    setSpendNote('');
    setSpendOpen(false);
    setError('');
  }

  function onDelete() {
    const result = deleteLoan(active.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate('/loans');
  }

  const closed = loan.status === 'closed';

  return (
    <div className="page">
      <PageHead
        kicker={loanTypeLabel(loan.type)}
        title={loan.name}
        lede={loan.lender || 'Lender not set'}
      >
        <Link className="btn btn-ghost" to={`/loans/${loan.id}/edit`}>
          Edit
        </Link>
      </PageHead>

      <section className="hero compact">
        <div>
          <p className="kicker">{closed ? 'Cleared' : loan.type === 'credit_card' ? 'Card balance' : 'Still owed'}</p>
          <p className="hero-num">{formatINR(loan.outstanding)}</p>
          <p className="lede">
            {formatRate(loan.annualRate)} a year
            {loan.interestOnly ? ' · interest only' : ` · ${formatINR(monthly)} regular`}
            {due ? ` · ${duePhrase(due).toLowerCase()}` : ''}
            {loan.endDate ? ` · ends ${formatDate(loan.endDate)}` : ''}
          </p>
        </div>
        <div className="hero-side">
          <Meter
            value={loan.type === 'credit_card' ? (insight.utilization ?? insight.completion) : insight.completion}
            tone={loan.type === 'credit_card' ? 'clay' : 'sage'}
          />
          <small>
            {loan.type === 'credit_card'
              ? insight.utilization != null
                ? `${Math.round(insight.utilization * 100)}% of the limit is in use`
                : 'Add a limit to see utilisation'
              : `${Math.round(insight.completion * 100)}% of the original amount is cleared`}
          </small>
        </div>
      </section>

      <section className="stat-grid">
        <article className="stat">
          <span>Interest avoided</span>
          <strong>{formatINR(insight.interestSaved)}</strong>
          <small>By paying more than the regular amount</small>
        </article>
        <article className="stat">
          <span>Interest paid</span>
          <strong>{formatINR(insight.interestPaid)}</strong>
          <small>Since you started recording here</small>
        </article>
        <article className="stat">
          <span>Interest still ahead</span>
          <strong>{formatINR(insight.remainingInterest)}</strong>
          <small>If you only pay the regular amount from here</small>
        </article>
      </section>

      {closed ? (
        <section className="receipt">
          <p className="kicker">Loan complete</p>
          <h2>This balance is clear.</h2>
          <p>
            You paid {formatINR(insight.interestPaid)} in interest
            {insight.interestSaved > 0
              ? `, and paying ahead avoided another ${formatINR(insight.interestSaved)}.`
              : '.'}
          </p>
        </section>
      ) : (
        <section className="split">
          <form className="panel stack" onSubmit={onPay}>
            <p className="kicker">Record a payment</p>
            <h2>What did you send?</h2>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <label className="field">
              <span>Amount</span>
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={String(Math.round(monthly / 100))} />
            </label>
            <label className="field">
              <span>Date</span>
              <input type="date" value={paidOn} max={today} onChange={(event) => setPaidOn(event.target.value)} />
            </label>
            <label className="field">
              <span>Note</span>
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
            </label>
            {quote && !('error' in quote) ? (
              <div className="quote">
                <p>
                  {formatINR(quote.interestPortion)} interest · {formatINR(quote.principalPortion)} principal
                </p>
                <p>Balance after this: {formatINR(quote.balanceAfter)}</p>
                {quote.interestSaved > 0 ? (
                  <p className="saved-line">
                    This avoids about {formatINR(quote.interestSaved)} of future interest. You will have avoided{' '}
                    {formatINR(insight.interestSaved + quote.interestSaved)} on this loan.
                  </p>
                ) : quote.unpaidInterest > 0 ? (
                  <p>This does not cover the interest that has built up, so the balance rises by {formatINR(quote.unpaidInterest)}.</p>
                ) : quote.accrued === 0 ? (
                  <p>No interest has accrued since the balance date, so this payment reduces what you owe.</p>
                ) : (
                  <p>This matches the regular amount, so it keeps the schedule rather than shortening it.</p>
                )}
                {quote.surplus > 0 ? <p>{formatINR(quote.surplus)} is more than the balance and will not be applied.</p> : null}
                {quote.closed ? <p>This clears the loan.</p> : null}
              </div>
            ) : quote && 'error' in quote ? (
              <p className="field-error">{quote.error}</p>
            ) : null}
            <button className="btn btn-primary" type="submit">
              Update the loan
            </button>
            {loan.type === 'credit_card' ? (
              <button className="btn btn-ghost" type="button" onClick={() => setSpendOpen((open) => !open)}>
                {spendOpen ? 'Hide spend' : 'Add a card spend'}
              </button>
            ) : null}
          </form>
          <div className="stack">
            {receipt ? (
              <section className="receipt">
                <p className="kicker">Saved with this payment</p>
                <h2>{receipt.interestSaved > 0 ? formatINR(receipt.interestSaved) : 'On schedule'}</h2>
                <p>
                  {receipt.interestSaved > 0
                    ? `Paying more than the regular amount avoided about ${formatINR(receipt.interestSaved)} of interest. This loan has avoided ${formatINR(loanInsight(loan, payments, today).interestSaved)} in all.`
                    : `Recorded ${formatINR(receipt.amount)}. The balance is now ${formatINR(receipt.balanceAfter)}.`}
                </p>
              </section>
            ) : (
              <section className="panel">
                <p className="kicker">How to read a payment</p>
                <p>
                  Interest since the last update is taken first. Anything above the regular {formatINR(monthly)} reduces
                  the balance faster, and MoneyRes counts the interest that slice will no longer cost you.
                </p>
              </section>
            )}
            {spendOpen ? (
              <form className="panel stack" onSubmit={onSpend}>
                <p className="kicker">New spend</p>
                <label className="field">
                  <span>Amount</span>
                  <input inputMode="decimal" value={spendAmount} onChange={(event) => setSpendAmount(event.target.value)} />
                </label>
                <label className="field">
                  <span>Date</span>
                  <input type="date" value={spendDate} max={today} onChange={(event) => setSpendDate(event.target.value)} />
                </label>
                <label className="field">
                  <span>Note</span>
                  <input value={spendNote} onChange={(event) => setSpendNote(event.target.value)} />
                </label>
                <button className="btn btn-primary" type="submit">
                  Add to balance
                </button>
              </form>
            ) : null}
          </div>
        </section>
      )}

      <section className="panel">
        <p className="kicker">History</p>
        {history.length === 0 ? (
          <p className="empty-copy">Payments you record will gather here.</p>
        ) : (
          <ul className="history">
            {history.map((row) => (
              <li key={row.id} className="history-row">
                <span>
                  <strong>{row.title}</strong>
                  <small>
                    {formatDate(row.date)} · {row.detail}
                  </small>
                </span>
                <em>{formatINR(row.amount)}</em>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="confirm-row">
        {confirming ? (
          <>
            <span>Remove this loan and its payments?</span>
            <button className="btn btn-danger" type="button" onClick={onDelete}>
              Remove
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button className="btn btn-ghost" type="button" onClick={() => setConfirming(true)}>
            Remove this loan
          </button>
        )}
      </div>
    </div>
  );
}
