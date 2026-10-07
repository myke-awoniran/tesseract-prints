import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type TouchEvent } from 'react';
import { Link } from '../lib/router';
import { SLIDES } from '../content/site';
import { FallbackMark } from './Logo';
import { Icon } from './Icons';

const SLIDE_MS = 7000;
const SWIPE_PX = 50;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** The rendition the browser will pick for this viewport, so preloading doesn't fetch both. */
function previewSrc(s: (typeof SLIDES)[number]) {
  return s.srcSm && window.innerWidth * (window.devicePixelRatio || 1) <= 1600 ? s.srcSm : s.src;
}

export function Hero() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [hovering, setHovering] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const touchX = useRef<number | null>(null);

  // Preload every slide and only rotate through the ones whose image exists,
  // so a missing photo never shows up as a blank slide.
  useEffect(() => {
    SLIDES.forEach((s) => {
      const img = new Image();
      img.onload = () => setLoaded((l) => ({ ...l, [s.src]: true }));
      img.onerror = () => setLoaded((l) => ({ ...l, [s.src]: false }));
      img.src = previewSrc(s);
    });
  }, []);

  // Don't advance while the tab is in the background.
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Keep showing slides in their listed order even when they finish loading out of order.
  const slides = SLIDES.filter((s) => loaded[s.src]);
  const count = slides.length;

  const running = playing && !hovering && !hidden && count > 1;
  const active = count ? index % count : 0;
  const current = slides[active];

  useEffect(() => {
    if (!running) return undefined;
    timer.current = setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearTimeout(timer.current);
  }, [running, index, count]);

  const go = (n: number) => setIndex((n + count) % count);

  const onKeyDown = (e: KeyboardEvent) => {
    if (count < 2 || (e.target as HTMLElement).closest('a, input, textarea, select')) return;
    if (e.key === 'ArrowRight') go(active + 1);
    else if (e.key === 'ArrowLeft') go(active - 1);
  };
  const onTouchStart = (e: TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current === null || count < 2) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > SWIPE_PX) go(active + (dx < 0 ? 1 : -1));
  };

  return (
    <section
      className="hero"
      aria-roledescription="carousel"
      aria-label="Introduction"
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {count === 0 && (
        <div className="hero__slide hero__slide--fallback is-active" aria-hidden="true">
          <FallbackMark className="fallback-mark" />
        </div>
      )}
      {slides.map((s, i) => (
        <div
          key={s.src}
          className={`hero__slide${i === active ? ' is-active' : ''}${i % 2 ? ' is-alt' : ''}`}
          aria-hidden={i !== active}
          style={{ '--focus': s.focus ?? '50% 50%' } as CSSProperties}
        >
          <img
            src={s.src}
            srcSet={s.srcSm ? `${s.srcSm} 1280w, ${s.src} 2400w` : undefined}
            sizes="100vw"
            alt={s.alt}
            decoding="async"
          />
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
              <span key={current.src} className="hero__place">
                <span className="hero__city">{current.city}</span>
                {current.caption}
              </span>
            </div>
            <div className="hero__controls">
              {count > 1 &&
                slides.map((s, i) => (
                  <button
                    key={s.src}
                    type="button"
                    className={`hero__dot${i === active ? ' is-active' : ''}${running ? '' : ' is-paused'}`}
                    style={{ '--slide-ms': `${SLIDE_MS}ms` } as CSSProperties}
                    aria-label={`Show slide ${i + 1}: ${s.caption}, ${s.city}`}
                    aria-current={i === active ? 'true' : undefined}
                    onClick={() => go(i)}
                  >
                    <span key={`${active}-${running}`} />
                  </button>
                ))}
              {count > 1 && (
                <>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
                    onClick={() => setPlaying((p) => !p)}
                    style={{ marginLeft: 10 }}
                  >
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

      {current?.credit && (
        <a key={current.src} className="hero__credit" href={current.credit.url} target="_blank" rel="noopener noreferrer">
          Photo: {current.credit.author} · {current.credit.license}
        </a>
      )}
    </section>
  );
}
