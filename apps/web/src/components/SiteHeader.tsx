import { useEffect, useState } from 'react';
import { Link, useRouter } from '../lib/router';
import { Wordmark } from './Logo';
import { Icon } from './Icons';

const NAV = [
  { to: '/#services', label: 'Services' },
  { to: '/#institutions', label: 'Institutions' },
  { to: '/#governance', label: 'Governance' },
  { to: '/express', label: 'Express printing' },
  { to: '/#faq', label: 'FAQs' },
  { to: '/console/login', label: 'Client login' }
];

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const { path } = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!overlay) return undefined;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overlay]);

  useEffect(() => setOpen(false), [path]);

  const cls = ['site-header', overlay && 'is-overlay', overlay && (scrolled || open) && 'is-scrolled'].filter(Boolean).join(' ');

  return (
    <header className={cls}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="container site-header__inner">
        <Link to="/" className="brand" aria-label="Tesseract Prints home">
          <Wordmark size={40} />
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="site-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <Icon.Close /> : <Icon.Menu />}
        </button>
        <nav id="site-nav" className={`site-nav${open ? ' is-open' : ''}`} aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <div className="site-nav__actions">
            <Link to="/#contact" className="btn btn--light btn--small" onClick={() => setOpen(false)}>
              Speak with us
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
