import { useId, useState } from 'react';
import { FAQ } from '../content/site';

export function Faq() {
  const [topic, setTopic] = useState(0);
  const [open, setOpen] = useState(0);
  const id = useId();

  const select = (i: number) => {
    setTopic(i);
    setOpen(0);
  };

  return (
    <div className="faq">
      <div>
        <p className="section-name">Questions</p>
        <h2 className="display" style={{ marginTop: 28 }}>
          What our clients ask first.
        </h2>
        <div className="faq__tabs" role="tablist" aria-label="Question topics">
          {FAQ.map((t, i) => (
            <button
              key={t.topic}
              type="button"
              role="tab"
              id={`${id}-tab-${i}`}
              aria-selected={i === topic}
              aria-controls={`${id}-panel`}
              className="faq__tab"
              onClick={() => select(i)}
            >
              {t.topic}
            </button>
          ))}
        </div>
      </div>
      <div className="faq__list" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${topic}`}>
        {FAQ[topic].items.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} className={`faq__item${isOpen ? ' is-open' : ''}`}>
              <h3 style={{ margin: 0 }}>
                <button
                  type="button"
                  className="faq__q"
                  aria-expanded={isOpen}
                  aria-controls={`${id}-a-${i}`}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  {item.q}
                  <span className="faq__icon" aria-hidden="true" />
                </button>
              </h3>
              <div className="faq__a" id={`${id}-a-${i}`} role="region" aria-hidden={!isOpen}>
                <div>
                  <p>{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
