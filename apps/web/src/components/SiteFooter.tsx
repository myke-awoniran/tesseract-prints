import { Link } from '../lib/router';
import { BrandMark, Wordmark } from './Logo';
import { Icon } from './Icons';
import { CONTACT } from '../content/site';

const COLUMNS = [
  {
    title: 'Firm',
    links: [
      { to: '/#services', label: 'Services' },
      { to: '/#institutions', label: 'Institutions' },
      { to: '/#governance', label: 'Governance' },
      { to: '/#engagement', label: 'How we engage' }
    ]
  },
  {
    title: 'Clients',
    links: [
      { to: '/express', label: 'Express printing' },
      { to: '/console/login', label: 'Client login' },
      { to: '/#faq', label: 'FAQs' },
      { to: '/#contact', label: 'Request a consultation' }
    ]
  }
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__cta">
          <h2>
            Have a document that cannot go astray?
          </h2>
          <div className="site-footer__cta-actions">
            <Link to="/#contact" className="btn btn--light">
              Arrange a consultation
            </Link>
            <Link to="/express" className="btn btn--ghost-light">
              Print something today
            </Link>
          </div>
        </div>

        <div className="site-footer__grid">
          <div className="site-footer__intro">
            <Wordmark size={40} />
            <p>Confidential document printing, sealing and delivery for institutions in Abuja.</p>
            <ul className="site-footer__assurances">
              <li><Icon.Lock width={16} height={16} /> Encrypted end to end</li>
              <li><Icon.Seal width={16} height={16} /> Tamper-evident seals</li>
              <li><Icon.Clock width={16} height={16} /> Erased within 24 hours</li>
            </ul>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3>{col.title}</h3>
              <ul>
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div>
            <h3>Contact</h3>
            <ul>
              <li><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
              <li><a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}>{CONTACT.phone}</a></li>
              <li className="site-footer__muted">{CONTACT.address}</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="container site-footer__base">
        <span>© {new Date().getFullYear()} {CONTACT.company}. All rights reserved.</span>
        <span>Documents are erased within 24 hours of upload.</span>
        <button type="button" className="site-footer__top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          Back to top
          <Icon.ArrowRight width={16} height={16} style={{ transform: 'rotate(-90deg)' }} />
        </button>
      </div>

      <div className="site-footer__giant" aria-hidden="true">
        <BrandMark size={120} fill="transparent" line="currentColor" />
        <span>Tesseract</span>
      </div>
    </footer>
  );
}
