import { Link } from '../lib/router';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { Hero } from '../components/Hero';
import { Faq } from '../components/Faq';
import { ConsultationForm } from '../components/ConsultationForm';
import { Icon } from '../components/Icons';
import { useReveal } from '../lib/useReveal';
import { SERVICES, INSTITUTIONS, COMMITMENTS, JOURNEY, CONTACT } from '../content/site';

export default function Home() {
  useReveal();

  return (
    <>
      <SiteHeader overlay />
      <main>
        <Hero />

        <section className="section" aria-labelledby="about-title">
          <div className="container split">
            <p className="section-name reveal">Who we are</p>
            <div className="stack-lg reveal">
              <h2 id="about-title" className="statement">
                Tesseract Prints is a discreet document partner for organisations whose paperwork carries legal, commercial or diplomatic
                weight. We produce, seal and deliver what matters, and leave nothing behind.
              </h2>
              <p className="body-lg">
                Every engagement is governed by a written confidentiality agreement, handled by one accountable operator, and closed
                with the document erased. Our clients choose us for a simple reason: their documents remain theirs.
              </p>
            </div>
          </div>
        </section>

        <section className="section section--dark" aria-labelledby="express-title" id="express">
          <div className="container express">
            <div className="reveal">
              <p className="section-name">Express printing</p>
              <h2 id="express-title" className="display" style={{ marginTop: 28 }}>
                One document, printed and at your door today.
              </h2>
              <p className="body-lg" style={{ marginTop: 24 }}>
                For individuals and teams who need something printed now. No account, no forms to sign. The same encryption, sealing and
                24-hour erasure our institutional clients rely on.
              </p>
              <div className="hero__actions">
                <Link to="/express" className="btn btn--light">
                  Start an express order
                </Link>
              </div>
              <div className="express__meta">
                <span>Card, transfer or USSD</span>
                <span>Same day in central Abuja</span>
                <span>Private tracking link</span>
              </div>
            </div>
            <ol className="express__steps reveal reveal-group">
              <li>
                <h3>Upload your document</h3>
                <p>PDF, Word or image files, encrypted the moment they leave your device.</p>
              </li>
              <li>
                <h3>Choose finishing and delivery</h3>
                <p>Colour, binding and copies, then the address. You see the full amount before you pay.</p>
              </li>
              <li>
                <h3>Receive it under seal</h3>
                <p>Released to you against a six-digit code. Your file is erased once you have it.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="section section--paper" id="services" aria-labelledby="services-title">
          <div className="container">
            <div className="split reveal">
              <p className="section-name">Services</p>
              <div>
                <h2 id="services-title" className="display">
                  Capabilities built around confidentiality.
                </h2>
              </div>
            </div>
            <div className="services reveal reveal-group">
              {SERVICES.map((s) => (
                <article key={s.title} className="service">
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="institutions" aria-labelledby="inst-title">
          <div className="container split">
            <div className="reveal">
              <p className="section-name">Institutions</p>
            </div>
            <div className="stack-lg reveal">
              <h2 id="inst-title" className="display">
                Where discretion is not optional.
              </h2>
              <p className="body-lg">
                We work with a deliberately limited number of institutions so that each one receives the attention its documents deserve.
              </p>
              <div className="roster reveal reveal-group">
                {INSTITUTIONS.map((i) => (
                  <div key={i.name} className="roster__row">
                    <h3>{i.name}</h3>
                    <p>{i.work}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="governance" aria-labelledby="gov-title">
          <div className="container governance">
            <div className="governance__image reveal">
              <img src="/images/bridge.jpg" alt="" loading="lazy" />
            </div>
            <div className="reveal">
              <p className="section-name">Governance</p>
              <h2 id="gov-title" className="display" style={{ marginTop: 28 }}>
                An unbroken chain of custody.
              </h2>
              <p className="body-lg" style={{ marginTop: 24 }}>
                Our controls follow the discipline financial institutions apply to client assets: clear accountability, minimal access and a
                record of every step.
              </p>
              <div className="commitments reveal reveal-group">
                {COMMITMENTS.map((c) => (
                  <div key={c.title}>
                    <h3>{c.title}</h3>
                    <p>{c.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="engagement" aria-labelledby="eng-title">
          <div className="container">
            <div className="split reveal">
              <p className="section-name">How we engage</p>
              <h2 id="eng-title" className="display">
                A considered relationship, not a transaction.
              </h2>
            </div>
            <ol className="journey reveal reveal-group">
              {JOURNEY.map((j) => (
                <li key={j.title}>
                  <h3>{j.title}</h3>
                  <p>{j.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section section--paper" id="faq" aria-label="Frequently asked questions">
          <div className="container reveal">
            <Faq />
          </div>
        </section>

        <section className="section section--white" id="contact" aria-labelledby="contact-title">
          <div className="container consult">
            <div className="reveal">
              <p className="section-name">Consultation</p>
              <h2 id="contact-title" className="display" style={{ marginTop: 28 }}>
                Let us take care of it.
              </h2>
              <p className="body-lg" style={{ marginTop: 24 }}>
                Tell us about your institution. We will respond within one business day to arrange a private conversation and a proposal
                shaped around your needs.
              </p>
              <div className="consult__contact">
                <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
                <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}>{CONTACT.phone}</a>
                <span>{CONTACT.address}</span>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
                  <Icon.Lock /> Enquiries are handled in confidence.
                </span>
              </div>
            </div>
            <div className="reveal">
              <ConsultationForm />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
