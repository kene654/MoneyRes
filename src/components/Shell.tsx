import { NavLink, Outlet } from 'react-router-dom';
import { useLedger } from '../state/store';

const links = [
  { to: '/', label: 'Overview', end: true },
  { to: '/loans', label: 'Loans', end: false },
  { to: '/goals', label: 'Goals', end: false },
  { to: '/income', label: 'Income', end: false },
  { to: '/account', label: 'Account', end: false },
];

export function Shell() {
  const { user } = useLedger();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand" end>
          <span className="brand-mark" aria-hidden="true" />
          Artha
        </NavLink>
        <nav className="nav" aria-label="Primary">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <strong>{user?.name}</strong>
          <span>{user?.income?.type === 'self' ? 'Self-employed' : 'Employed'}</span>
        </div>
      </aside>
      <main className="workspace">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Primary mobile">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
