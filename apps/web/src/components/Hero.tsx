import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from '../lib/router';
import { SLIDES } from '../content/site';
import { FallbackMark } from './Logo';
import { Icon } from './Icons';

const SLIDE_MS = 7000;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function Hero() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [hovering, setHovering] = useState(false);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Preload every slide and only rotate through the ones whose image exists,
  // so a missing photo never shows up as a blank slide.
  useEffect(() => {
    SLIDES.forEach((s) => {
      const img = new Image();
      img.onload = () => setLoaded((l) => ({ ...l, [s.src]: true }));
      img.onerror = () => setLoaded((l) => ({ ...l, [s.src]: false }));
      img.src = s.src;
    });
  }, []);

  const slides = SLIDES.filter((s) => loaded[s.src]);
  const count = slides.length;

  const running = playing && !hovering && count > 1;
  const active = count ? index % count : 0;

  useEffect(() => {
    if (!running) return undefined;
    timer.current = setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearTimeout(timer.current);
  }, [running, index, count]);

  const go = (n: number) => setIndex((n + count) % count);

  return (
    <section className="hero" aria-roledescription="carousel" aria-label="Introduction">
      {count === 0 && (
        <div className="hero__slide hero__slide--fallback is-active" aria-hidden="true">
          <FallbackMark className="fallback-mark" />
        </div>
      )}
      {slides.map((s, i) => (
        <div key={s.src} className={`hero__slide${i === active ? ' is-active' : ''}`} aria-hidden={i !== active}>
          <img src={s.src} alt={s.alt} />
        </div>
      ))}
      <div className="hero__veil" />

      <div className="container hero__content" id="main">
        <h1 className="hero__title">Trusted with the documents that move institutions.</h1>
        <p className="hero__lede">
          Secure production, sealing and delivery of sensitive documents for law chambers, contractors, financial institutions and
          diplomatic missions across Abuja.
        </p>
        <div className="hero__actions">
          <Link to="/#contact" className="btn btn--light">
            Arrange a consultation
          </Link>
          <Link to="/express" className="btn btn--ghost-light">
            Print something today
          </Link>
        </div>

        {count > 0 && (
        <div className="hero__bar" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
          <div className="hero__caption" aria-live="polite">
            <span className="hero__counter">
              {String(active + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
            </span>
            <span>{slides[active]?.caption}</span>
          </div>
          <div className="hero__controls">
            {count > 1 && slides.map((s, i) => (
              <button
                key={s.src}
                type="button"
                className={`hero__dot${i === active ? ' is-active' : ''}${running ? '' : ' is-paused'}`}
                style={{ '--slide-ms': `${SLIDE_MS}ms` } as CSSProperties}
                aria-label={`Show slide ${i + 1}: ${s.caption}`}
                aria-current={i === active ? 'true' : undefined}
                onClick={() => go(i)}
              >
                <span key={`${active}-${running}`} />
              </button>
            ))}
            {count > 1 && (
            <>
            <button type="button" className="icon-btn" aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} onClick={() => setPlaying((p) => !p)} style={{ marginLeft: 10 }}>
              {playing ? <Icon.Pause /> : <Icon.Play />}
            </button>
            <button type="button" className="icon-btn" aria-label="Previous slide" onClick={() => go(active - 1)}>
              <Icon.ArrowLeft />
            </button>
            <button type="button" className="icon-btn" aria-label="Next slide" onClick={() => go(active + 1)}>
              <Icon.ArrowRight />
            </button>
            </>
            )}
          </div>
        </div>
        )}
      </div>
    </section>
  );
}
