import { useEffect, useState, type ReactNode } from 'react';
import type { Role } from '@tesseract/shared';
import { useAuth } from '../../lib/auth';
import { Link, Redirect, useRouter } from '../../lib/router';
import { Wordmark } from '../../components/Logo';
import { Icon } from '../../components/Icons';
import { LiveStatus, LiveToasts } from '../../components/Live';
import { initials } from '../../lib/format';
import { consoleClass, useConsoleTheme } from '../../lib/theme';

type NavItem = { to: string; label: string; icon: (typeof Icon)[keyof typeof Icon] };

const CLIENT_NAV: NavItem[] = [
  { to: '/console', label: 'Overview', icon: Icon.Grid },
  { to: '/console/orders', label: 'Orders', icon: Icon.List },
  { to: '/console/orders/new', label: 'New order', icon: Icon.Plus },
  { to: '/console/billing', label: 'Billing', icon: Icon.Receipt },
  { to: '/console/settings', label: 'Settings', icon: Icon.Settings }
];
const OPERATOR_NAV: NavItem[] = [
  { to: '/console/ops', label: 'Overview', icon: Icon.Grid },
  { to: '/console/queue', label: 'Print queue', icon: Icon.Printer },
  { to: '/console/deliveries', label: 'Deliveries', icon: Icon.Truck },
  { to: '/console/ops/orders', label: 'All orders', icon: Icon.List },
  { to: '/console/clients', label: 'Clients', icon: Icon.Users },
  { to: '/console/ops/invoices', label: 'Invoices', icon: Icon.Receipt },
  { to: '/console/emails', label: 'Emails', icon: Icon.Mail }
];

export function ConsoleLayout({ children, roles }: { children: ReactNode; roles?: readonly Role[] }) {
  const { state, logout } = useAuth();
  const { path } = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, toggleTheme] = useConsoleTheme();

  useEffect(() => setMenuOpen(false), [path]);

  if (state.status === 'loading') {
    return (
      <div className={consoleClass(theme)} style={{ display: 'grid', placeItems: 'center' }}>
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }
  if (state.status !== 'signed-in') return <Redirect to="/console/login" />;
  const { user, organization } = state;
  if (roles && !roles.includes(user.role)) {
    return <Redirect to={user.role === 'operator' ? '/console/ops' : '/console'} />;
  }

  const nav = user.role === 'operator' ? OPERATOR_NAV : CLIENT_NAV;

  return (
    <div className={consoleClass(theme)}>
      <div className="mobile-bar">
        <Link to="/console" className="sidebar__brand" aria-label="Console home">
          <Wordmark size={30} fill="#FFFFFF" line="#2B1442" />
        </Link>
        <button type="button" className="sidebar__signout" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          <Icon.Menu />
        </button>
      </div>
      <div className="shell">
        <aside className={`sidebar${menuOpen ? ' is-open' : ''}`} aria-label="Console">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link to="/" className="sidebar__brand" aria-label="Tesseract Prints website">
              <Wordmark size={30} fill="#FFFFFF" line="#2B1442" />
            </Link>
            {menuOpen && (
              <button type="button" className="sidebar__signout" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                <Icon.Close />
              </button>
            )}
          </div>
          <div className="sidebar__org">
            <small>{user.role === 'operator' ? 'Tesseract Prints' : 'Organisation'}</small>
            <strong>{user.role === 'operator' ? 'Print room' : organization?.name}</strong>
          </div>
          <p className="sidebar__label">{user.role === 'operator' ? 'Print room' : 'Workspace'}</p>
          <nav>
            {nav.map((item) => (
              <Link key={item.to} to={item.to}>
                <item.icon />
                {item.label}
              </Link>
            ))}
          </nav>
          <LiveStatus />
          <div className="sidebar__user">
            <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
            <button
              type="button"
              className="sidebar__signout"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title={theme === 'light' ? 'Dark mode' : 'Light mode'}
              onClick={toggleTheme}
            >
              {theme === 'light' ? <Icon.Moon width={18} height={18} /> : <Icon.Sun width={18} height={18} />}
            </button>
            <button type="button" className="sidebar__signout" aria-label="Sign out" title="Sign out" onClick={logout}>
              <Icon.SignOut width={18} height={18} />
            </button>
          </div>
        </aside>
        <main className="main" id="main">
          {children}
        </main>
      </div>
      <LiveToasts />
    </div>
  );
}

export function PageHead({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="main__head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
