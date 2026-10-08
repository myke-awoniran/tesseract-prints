import { useCallback, useEffect, useState } from 'react';
import { FULFILMENT_FLOW, statusLabel, formatNaira, type OrderResponse, type OrderView } from '@tesseract/shared';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { Icon } from '../components/Icons';
import { Link, useQuery, type RouteParams } from '../lib/router';
import { api, recallExpressToken, rememberExpressOrder, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';

type TrackState = { status: 'loading' | 'ready' | 'error'; order: OrderView | null; error: string };

export default function Track({ params }: { params: RouteParams }) {
  const query = useQuery();
  const ref = (params.ref ?? '').toUpperCase();
  const token = query.get('t') || recallExpressToken(ref);
  const [state, setState] = useState<TrackState>({ status: 'loading', order: null, error: '' });
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setState({ status: 'error', order: null, error: 'Open this page from the tracking link you received when you placed the order.' });
      return;
    }
    try {
      const data = await api<OrderResponse>(`/track/${encodeURIComponent(ref)}?t=${encodeURIComponent(token)}`);
      rememberExpressOrder(ref, token);
      setState({ status: 'ready', order: data.order, error: '' });
    } catch (err) {
      setState((s) => (s.order ? s : { status: 'error', order: null, error: errorMessage(err) }));
    }
  }, [ref, token]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const order = state.order;
  const link = `${window.location.origin}/track/${ref}?t=${token}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const reached = (id: string) => order?.timeline.find((t) => t.status === id);
  const currentIndex = order ? FULFILMENT_FLOW.indexOf(order.status) : -1;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="page-head">
          <div className="container">
            <h1>Order {ref}</h1>
            <p>This page updates on its own. Keep the link private: it is the key to your order.</p>
          </div>
        </div>

        <div className="container">
          {state.status === 'loading' && (
            <p className="center-stage">
              <span className="spinner" aria-hidden="true" /> Loading your order
            </p>
          )}
          {state.status === 'error' && (
            <div className="center-stage">
              <h1>We couldn’t open this order.</h1>
              <p>{state.error}</p>
              <Link to="/express" className="btn btn--primary">Start a new express order</Link>
            </div>
          )}

          {order && (
            <div className="track">
              <section aria-labelledby="track-status">
                <p className="form-note">Current status</p>
                <h2 id="track-status" className="track__status">
                  {order.statusLabel}
                </h2>

                {order.status === 'awaiting_payment' ? (
                  <div className="alert" style={{ marginTop: 28 }}>
                    Payment has not been confirmed yet. If you have just paid, this page will update within a minute.
                  </div>
                ) : order.status === 'cancelled' ? (
                  <div className="alert" style={{ marginTop: 28 }}>This order was cancelled and the document erased.</div>
                ) : (
                  <ol className="timeline">
                    {FULFILMENT_FLOW.map((id, i) => {
                      const hit = reached(id);
                      const cls = i < currentIndex || (i === currentIndex && id === 'delivered') ? 'is-done' : i === currentIndex ? 'is-current' : '';
                      return (
                        <li key={id} className={cls}>
                          <span className="timeline__dot">{cls === 'is-done' && <Icon.Check width={14} height={14} />}</span>
                          <div>
                            <div className="timeline__label">{statusLabel(id)}</div>
                            {hit && <div className="timeline__time">{formatDate(hit.at)}</div>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}

                {order.dispatch && order.status === 'out_for_delivery' && (
                  <div className="courier">
                    <p className="form-note">Your courier</p>
                    <div className="courier__row">
                      <span className="courier__avatar" aria-hidden="true">{order.dispatch.riderName.slice(0, 1).toUpperCase()}</span>
                      <div>
                        <strong>{order.dispatch.riderName}</strong>
                        <a href={`tel:${order.dispatch.riderPhone.replace(/[^\d+]/g, '')}`}>{order.dispatch.riderPhone}</a>
                      </div>
                      {order.dispatch.eta && (
                        <div className="courier__eta">
                          <span>Expected</span>
                          <strong>{new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(new Date(order.dispatch.eta))}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {order.updates.length > 0 && (
                  <div className="updates">
                    <p className="form-note">Updates from the print room</p>
                    <ol>
                      {[...order.updates].reverse().map((u) => (
                        <li key={u.id}>
                          <p>{u.message}</p>
                          <time dateTime={u.at}>{formatDate(u.at)}</time>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </section>

              <aside>
                {order.handoverCode && (
                  <div className="code-card">
                    <p>Your handover code</p>
                    <div className="code-card__code" aria-label={`Handover code ${order.handoverCode.split('').join(' ')}`}>
                      {order.handoverCode}
                    </div>
                    <p>Give this code to the courier only when the sealed envelope is in your hands. It confirms delivery.</p>
                  </div>
                )}
                <div className="meta-card">
                  <dl>
                    <div>
                      <dt>Document</dt>
                      <dd>{order.file.name}</dd>
                    </div>
                    <div>
                      <dt>Document storage</dt>
                      <dd>
                        {order.file.erasedAt
                          ? `Erased ${formatDate(order.file.erasedAt)}`
                          : order.file.available
                            ? `Encrypted. Erased automatically by ${formatDate(order.file.expiresAt)}`
                            : 'Erased'}
                      </dd>
                    </div>
                    <div>
                      <dt>Delivering to</dt>
                      <dd>
                        {order.delivery.recipientName}, {order.delivery.area}
                      </dd>
                    </div>
                    <div>
                      <dt>Paid</dt>
                      <dd>{order.payment.status === 'paid' ? formatNaira(order.quote.total) : 'Not yet'}</dd>
                    </div>
                  </dl>
                  <button type="button" className="btn btn--outline btn--small btn--block" style={{ marginTop: 22 }} onClick={copyLink}>
                    {copied ? 'Link copied' : 'Copy tracking link'}
                  </button>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
