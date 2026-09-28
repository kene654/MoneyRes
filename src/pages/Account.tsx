import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IncomeEditor } from '../components/IncomeEditor';
import { ErrorNote, PageHead } from '../components/ui';
import { formatDate } from '../domain/dates';
import { logout, updateName, useLedger } from '../state/store';

export function AccountPage() {
  const { user } = useLedger();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function saveName() {
    const result = updateName(name);
    if (!result.ok) {
      setError(result.error);
      setMessage('');
      return;
    }
    setError('');
    setMessage('Name updated.');
  }

  function signOut() {
    logout();
    navigate('/login');
  }

  return (
    <div className="page narrow">
      <PageHead
        kicker="Account"
        title={user?.name ?? 'Account'}
        lede={user ? `${user.email} · joined ${formatDate(user.createdAt)}` : ''}
      />
      <section className="panel stack">
        <p className="kicker">Profile</p>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="row-actions">
          <button className="btn btn-ghost" type="button" onClick={saveName}>
            Save name
          </button>
          {message ? <span className="fine">{message}</span> : null}
        </div>
      </section>
      <IncomeEditor />
      <section className="panel device-card">
        <div className="device-copy">
          <p className="kicker">This device</p>
          <h2>Saved in this browser</h2>
          <ul className="device-points">
            <li>Your desk stays on this device until you sign out.</li>
            <li>Add MoneyRes to your home screen to open it like an app.</li>
            <li>The same ledger can move to an iPhone or Android app later.</li>
          </ul>
        </div>
        <div className="device-foot">
          <button className="btn btn-danger" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
