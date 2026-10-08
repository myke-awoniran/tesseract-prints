import { useState } from 'react';
import { FULFILMENT_FLOW, statusLabel, formatNaira, finishingLabel, paperTypeLabel, type OpsOrderResponse, type OrderResponse, type OrderStatus, type OrderView } from '@tesseract/shared';
import { api, downloadFile, errorMessage } from '../../lib/api';
import { Link, type RouteParams } from '../../lib/router';
import { useAsync } from '../../lib/useAsync';
import { formatBytes, formatDate, pillClass } from '../../lib/format';
import { PageHead } from '../console/ConsoleLayout';
import { Icon } from '../../components/Icons';
import { DeliverForm, RiderForm, UpdateComposer, UpdatesFeed, formatTime } from '../../components/ops';
import { useLiveReload } from '../../lib/realtime';

const ACTION_LABELS: Record<string, string> = {
  file_downloaded: 'Downloaded the file',
  status_changed: 'Changed status',
  file_erased: 'File erased',
  update_posted: 'Posted an update',
  rider_assigned: 'Assigned a rider',
  email_resent: 'Resent an email'
};

const EMAIL_STATUS: Record<string, string> = { sent: 'Sent', failed: 'Failed', skipped: 'Not sent' };

function NextStep({ order, onChanged }: { order: OrderView; onChanged: (o: OrderView) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const next = FULFILMENT_FLOW[FULFILMENT_FLOW.indexOf(order.status) + 1];

  async function advance(status: OrderStatus) {
    setBusy(true);
    setError('');
    try {
      const res = await api<OrderResponse>(`/ops/orders/${order.ref}/status`, { method: 'POST', auth: true, body: { status } });
      onChanged(res.order);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (order.status === 'awaiting_payment') return <p className="muted-note">Waiting for the customer to pay. Nothing to do yet.</p>;
  if (!next) return null;
  if (next === 'out_for_delivery') {
    return (
      <>
        <p className="muted-note">Sealed and ready. Assign a rider to send it out. The customer is emailed the rider’s name, phone and arrival time.</p>
        <RiderForm order={order} sendOut onDone={onChanged} />
      </>
    );
  }
  if (next === 'delivered') return <DeliverForm order={order} onDone={onChanged} />;
  return (
    <div className="ops-form__actions" style={{ justifyContent: 'flex-start' }}>
      <button type="button" className="c-btn c-btn--primary" onClick={() => advance(next)} disabled={busy}>
        {busy && <span className="spinner" aria-hidden="true" />}
        Mark {statusLabel(next).toLowerCase()}
      </button>
      {error && <div className="c-alert" role="alert">{error}</div>}
    </div>
  );
}

function CancelOrder({ order, onChanged }: { order: OrderView; onChanged: (o: OrderView) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function cancel() {
    setBusy(true);
    setError('');
    try {
      const res = await api<OrderResponse>(`/ops/orders/${order.ref}/status`, { method: 'POST', auth: true, body: { status: 'cancelled', note: reason } });
      onChanged(res.order);
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="c-btn c-btn--quiet c-btn--small danger-link" onClick={() => setOpen(true)}>
        Cancel order
      </button>
    );
  }
  return (
    <div className="danger-zone">
      <div className="c-field">
        <label htmlFor="cancel-reason">Reason (sent to the customer)</label>
        <textarea id="cancel-reason" className="c-input" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The file was password-protected, so we couldn’t print it." />
      </div>
      <p className="muted-note">The file is erased immediately and the customer is emailed.{order.payment.status === 'paid' ? ` Refund the payment in ${order.payment.provider ?? 'the payment dashboard'}.` : ''}</p>
      {error && <div className="c-alert" role="alert">{error}</div>}
      <div className="ops-form__actions">
        <button type="button" className="c-btn c-btn--quiet c-btn--small" onClick={() => setOpen(false)}>
          Keep order
        </button>
        <button type="button" className="c-btn c-btn--danger c-btn--small" onClick={cancel} disabled={busy}>
          {busy && <span className="spinner" aria-hidden="true" />}
          Cancel and erase file
        </button>
      </div>
    </div>
  );
}

export default function OpsOrderDetail({ params }: { params: RouteParams }) {
  const ref = (params.ref ?? '').toUpperCase();
  const live = useLiveReload({ order: (o) => o.ref === ref, delay: 1200 });
  const [{ loading, data, error }, setState] = useAsync((signal) => api<OpsOrderResponse>(`/ops/orders/${encodeURIComponent(ref)}`, { auth: true, signal }), [ref, live]);
  const [actionError, setActionError] = useState('');
  const [resending, setResending] = useState('');
  const order = data?.order;
  const current = order ? FULFILMENT_FLOW.indexOf(order.status) : -1;
  const closed = order?.status === 'delivered' || order?.status === 'cancelled';

  async function refresh() {
    try {
      const fresh = await api<OpsOrderResponse>(`/ops/orders/${encodeURIComponent(ref)}`, { auth: true });
      setState({ loading: false, data: fresh, error: '' });
    } catch {
      /* keep what we have */
    }
  }

  function onChanged(updated: OrderView) {
    setState((s) => (s.data ? { ...s, data: { ...s.data, order: updated } } : s));
    // Emails and log entries are written just after the change; pick them up.
    setTimeout(refresh, 1200);
  }

  async function download() {
    if (!order) return;
    setActionError('');
    try {
      await downloadFile(`/ops/orders/${order.ref}/file`, order.file.name ?? `${order.ref}.pdf`);
      refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function resend(id: string) {
    setResending(id);
    try {
      await api(`/ops/emails/${id}/resend`, { method: 'POST', auth: true });
      await refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setResending('');
    }
  }

  return (
    <>
      <PageHead title={`Order ${ref}`} subtitle={order ? `${order.title} · ${order.channel === 'express' ? 'Express' : 'Account'} order` : ''}>
        <Link to="/console/ops/orders" className="c-btn c-btn--quiet">All orders</Link>
      </PageHead>
      {error && <div className="c-alert" role="alert">{error}</div>}
      {actionError && <div className="c-alert" role="alert">{actionError}</div>}
      {loading && !order && <p className="muted-note"><span className="spinner" aria-hidden="true" /> Loading order</p>}

      {order && data && (
        <div className="detail">
          <div className="stack">
            <section className="panel">
              <div className="panel__head">
                <h2>Progress</h2>
                <span className={pillClass(order.status)}>{order.statusLabel}</span>
              </div>
              {order.status === 'cancelled' ? (
                <p className="muted-note">
                  Cancelled {formatDate(order.timeline[order.timeline.length - 1]?.at)}
                  {order.timeline[order.timeline.length - 1]?.note ? `: ${order.timeline[order.timeline.length - 1].note}` : ''}
                </p>
              ) : (
                <ol className="c-timeline">
                  {FULFILMENT_FLOW.map((id, i) => {
                    const hit = order.timeline.find((t) => t.status === id);
                    return (
                      <li key={id} className={i <= current ? 'is-done' : ''}>
                        <i aria-hidden="true" />
                        <div>
                          {statusLabel(id)}
                          {hit && <small>{formatDate(hit.at)}{hit.note ? ` · ${hit.note}` : ''}</small>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {!closed && (
                <div className="next-step">
                  <NextStep order={order} onChanged={onChanged} />
                </div>
              )}
            </section>

            {(order.status === 'out_for_delivery' || order.updates.length > 0 || order.dispatch) && (
              <section className="panel">
                <div className="panel__head">
                  <h2>Delivery</h2>
                  {order.dispatch?.eta && <span>ETA {formatTime(order.dispatch.eta)}</span>}
                </div>
                {order.dispatch && (
                  <div className="rider rider--wide">
                    <span className="avatar" aria-hidden="true">{order.dispatch.riderName.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <strong>{order.dispatch.riderName}</strong>
                      <a href={`tel:${order.dispatch.riderPhone.replace(/[^\d+]/g, '')}`}>{order.dispatch.riderPhone}</a>
                    </div>
                    <span className="muted">Assigned {formatDate(order.dispatch.assignedAt)}</span>
                  </div>
                )}
                {!closed && <UpdateComposer order={order} onDone={onChanged} />}
                <h3 className="sub-head">Updates the customer can see</h3>
                <UpdatesFeed updates={order.updates} />
              </section>
            )}

            <section className="panel">
              <div className="panel__head">
                <h2>Job</h2>
              </div>
              <dl className="kv">
                <div><dt>Document</dt><dd>{order.file.name} {order.file.size ? `· ${formatBytes(order.file.size)}` : ''}</dd></div>
                <div><dt>Printing</dt><dd>{order.options.pages} pages × {order.options.copies} {order.options.copies === 1 ? 'copy' : 'copies'} · {order.options.colour === 'colour' ? 'Colour' : 'Black and white'} · {order.options.sides === 'double' ? 'Double-sided' : 'Single-sided'} · {order.options.paperSize} · {paperTypeLabel(order.options.paperType)}</dd></div>
                <div><dt>Sheets</dt><dd>{order.quote.sheets}</dd></div>
                <div><dt>Finishing</dt><dd>{finishingLabel(order.options.finishing)}</dd></div>
              </dl>
              <div className="file-row">
                <Icon.Lock width={18} height={18} />
                <span>
                  {order.file.erasedAt
                    ? `Erased ${formatDate(order.file.erasedAt)}`
                    : order.file.available
                      ? `Encrypted · erased automatically ${formatDate(order.file.expiresAt)}`
                      : 'Erased'}
                </span>
                <button type="button" className="c-btn c-btn--quiet c-btn--small" onClick={download} disabled={!order.file.available}>
                  <Icon.Download width={16} height={16} /> Download
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="panel__head">
                <h2>Audit log</h2>
                <span>{data.log.length} entries</span>
              </div>
              {data.log.length === 0 ? (
                <p className="muted-note">No activity yet.</p>
              ) : (
                <ol className="activity">
                  {data.log.map((e, i) => (
                    <li key={i}>
                      <span className="activity__who">{e.by}</span>
                      <span>
                        {ACTION_LABELS[e.action] ?? e.action}
                        {e.detail && <small> · {e.detail.replace(/_/g, ' ')}</small>}
                      </span>
                      <time dateTime={e.at}>{formatDate(e.at)}</time>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <div className="stack">
            <section className="panel">
              <div className="panel__head">
                <h2>Customer</h2>
              </div>
              <dl className="kv kv--stacked">
                <div><dt>Name</dt><dd>{order.customer?.name}</dd></div>
                <div><dt>Email</dt><dd><a href={`mailto:${order.customer?.email}`}>{order.customer?.email}</a></dd></div>
                <div><dt>Phone</dt><dd><a href={`tel:${order.customer?.phone}`}>{order.customer?.phone}</a></dd></div>
                <div><dt>Deliver to</dt><dd>{order.delivery.recipientName}<br />{order.delivery.address}, {order.delivery.area}</dd></div>
                {order.delivery.phone && <div><dt>Recipient’s phone</dt><dd><a href={`tel:${order.delivery.phone}`}>{order.delivery.phone}</a></dd></div>}
                {order.delivery.instructions && <div><dt>Instructions</dt><dd>{order.delivery.instructions}</dd></div>}
              </dl>
            </section>

            <section className="panel">
              <div className="panel__head">
                <h2>Payment</h2>
                <span>{order.payment.status === 'paid' ? `Paid ${formatDate(order.payment.paidAt)}${order.payment.provider ? ` via ${order.payment.provider}` : ''}` : order.payment.status === 'invoiced' ? 'Invoiced' : 'Not paid'}</span>
              </div>
              <dl className="kv kv--money">
                <div><dt>Printing</dt><dd>{formatNaira(order.quote.printing)}</dd></div>
                {order.quote.finishing > 0 && <div><dt>Finishing</dt><dd>{formatNaira(order.quote.finishing)}</dd></div>}
                <div><dt>Sealing</dt><dd>{formatNaira(order.quote.sealing)}</dd></div>
                <div><dt>Delivery</dt><dd>{formatNaira(order.quote.delivery)}</dd></div>
                {order.quote.minimumTopUp > 0 && <div><dt>Minimum order</dt><dd>{formatNaira(order.quote.minimumTopUp)}</dd></div>}
                <div className="kv__total"><dt>Total</dt><dd>{formatNaira(order.quote.total)}</dd></div>
              </dl>
            </section>

            <section className="panel">
              <div className="panel__head">
                <h2>Emails</h2>
                <Link to="/console/emails">Outbox</Link>
              </div>
              {data.emails.length === 0 ? (
                <p className="muted-note">No emails for this order yet.</p>
              ) : (
                <ul className="mail-list">
                  {data.emails.map((m) => (
                    <li key={m.id}>
                      <span className={`dot dot--${m.status}`} aria-hidden="true" />
                      <div>
                        <strong>{m.subject}</strong>
                        <small>
                          {EMAIL_STATUS[m.status]} to {m.to} · {formatDate(m.at)}
                          {m.error ? ` · ${m.error}` : ''}
                        </small>
                      </div>
                      <button type="button" className="c-btn c-btn--quiet c-btn--small" onClick={() => resend(m.id)} disabled={resending === m.id}>
                        {resending === m.id ? 'Sending' : 'Resend'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {(order.status === 'queued' || order.status === 'printing' || order.status === 'out_for_delivery') && (
              <section className="panel">
                <div className="panel__head">
                  <h2>Rider</h2>
                </div>
                {order.status !== 'out_for_delivery' && !order.dispatch && <p className="muted-note">Optional: book a rider now so dispatch is quicker once the order is sealed.</p>}
                <RiderForm order={order} onDone={onChanged} />
              </section>
            )}

            {!closed && <CancelOrder order={order} onChanged={onChanged} />}
          </div>
        </div>
      )}
    </>
  );
}
