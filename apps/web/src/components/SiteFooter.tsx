import { Link } from '../lib/router';
import { Wordmark } from './Logo';
import { CONTACT } from '../content/site';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__grid">
          <div>
            <div className="brand">
              <Wordmark size={40} />
            </div>
            <p style={{ marginTop: 20, maxWidth: 320 }}>Confidential document printing, sealing and delivery for institutions in Abuja.</p>
          </div>
          <div>
            <h3>Firm</h3>
            <ul>
              <li><Link to="/#services">Services</Link></li>
              <li><Link to="/#institutions">Institutions</Link></li>
              <li><Link to="/#engagement">How we engage</Link></li>
            </ul>
          </div>
          <div>
            <h3>Clients</h3>
            <ul>
              <li><Link to="/express">Express printing</Link></li>
              <li><Link to="/console/login">Client login</Link></li>
              <li><Link to="/#faq">FAQs</Link></li>
            </ul>
          </div>
          <div>
            <h3>Contact</h3>
            <ul>
              <li><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
              <li><a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}>{CONTACT.phone}</a></li>
              <li>{CONTACT.address}</li>
            </ul>
          </div>
        </div>
        <div className="site-footer__base">
          <span>© {new Date().getFullYear()} {CONTACT.company}. All rights reserved.</span>
          <span>Documents are erased within 24 hours of upload.</span>
        </div>
      </div>
    </footer>
  );
}
