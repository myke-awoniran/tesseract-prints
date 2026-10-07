import { FULFILMENT_FLOW, statusLabel, formatNaira, finishingLabel, type OrderResponse } from '@tesseract/shared';
import { api } from '../../lib/api';
import { Link, type RouteParams } from '../../lib/router';
import { useAsync } from '../../lib/useAsync';
import { formatDate, formatBytes, pillClass } from '../../lib/format';
import { PageHead } from './ConsoleLayout';

export default function OrderDetail({ params }: { params: RouteParams }) {
  const ref = params.ref ?? '';
  const [{ loading, data, error }] = useAsync(
    (signal) => api<OrderResponse>(`/enterprise/orders/${encodeURIComponent(ref)}`, { auth: true, signal }),
    [ref]
  );
  const order = data?.order;
  const current = order ? FULFILMENT_FLOW.indexOf(order.status) : -1;

  return (
    <>
      <PageHead title={`Order ${ref}`} subtitle={order ? order.title : ''}>
        <Link to="/console/orders" className="c-btn c-btn--quiet">All orders</Link>
      </PageHead>
      {error && <div className="c-alert" role="alert">{error}</div>}
      {loading && !order && <p style={{ color: 'var(--c-muted)' }}><span className="spinner" aria-hidden="true" /> Loading order</p>}
      {order && (
        <div className="detail">
          <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
            <section className="panel">
              <div className="panel__head">
                <h2>Progress</h2>
                <span className={pillClass(order.status)}>{order.statusLabel}</span>
              </div>
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
            </section>
            <section className="panel">
              <div className="panel__head">
                <h2>Details</h2>
              </div>
              <dl className="kv">
                <div><dt>Document</dt><dd>{order.file.name} {order.file.size ? `· ${formatBytes(order.file.size)}` : ''}</dd></div>
                <div><dt>Printing</dt><dd>{order.options.pages} pages · {order.options.copies} {order.options.copies === 1 ? 'copy' : 'copies'} · {order.options.colour === 'colour' ? 'Colour' : 'Black and white'} · {order.options.sides === 'double' ? 'Double-sided' : 'Single-sided'} · {order.options.paperSize}</dd></div>
                <div><dt>Finishing</dt><dd>{finishingLabel(order.options.finishing)}</dd></div>
                <div><dt>Recipient</dt><dd>{order.delivery.recipientName}</dd></div>
                <div><dt>Address</dt><dd>{order.delivery.address}, {order.delivery.area}</dd></div>
                <div><dt>Amount</dt><dd>{formatNaira(order.quote.total)} · invoiced</dd></div>
                <div><dt>Placed</dt><dd>{formatDate(order.createdAt)}</dd></div>
              </dl>
            </section>
          </div>
          <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
            {order.handoverCode && (
              <div className="handover">
                <p style={{ color: '#fff', fontSize: 14 }}>Handover code</p>
                <strong>{order.handoverCode}</strong>
                <p>Share this with the recipient. The courier releases the sealed envelope only against this code.</p>
              </div>
            )}
            <section className="panel">
              <div className="panel__head">
                <h2>Document storage</h2>
              </div>
              <p style={{ color: 'var(--c-muted)' }}>
                {order.file.erasedAt
                  ? `Erased on ${formatDate(order.file.erasedAt)}. Only the order record remains.`
                  : order.file.available
                    ? `Stored encrypted. Erased on delivery, or automatically by ${formatDate(order.file.expiresAt)}.`
                    : 'The document has been erased. Only the order record remains.'}
              </p>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
