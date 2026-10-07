import { Link } from '../lib/router';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="center-stage">
        <h1>This page does not exist.</h1>
        <p>The link may be out of date. Head back to the home page or start an express order.</p>
        <div className="hero__actions" style={{ justifyContent: 'center' }}>
          <Link to="/" className="btn btn--primary">Go to the home page</Link>
          <Link to="/express" className="btn btn--outline">Start an express order</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
