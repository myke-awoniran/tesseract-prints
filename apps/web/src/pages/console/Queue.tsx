import { useState } from 'react';
import { FULFILMENT_FLOW, statusLabel, finishingLabel, type OrderResponse, type OrderStatus, type OrderView, type QueueResponse } from '@tesseract/shared';
import { api, downloadFile, errorMessage } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { formatDate, pillClass } from '../../lib/format';
import { PageHead } from './ConsoleLayout';
import { Icon } from '../../components/Icons';

function Job({ order, onChanged }: { order: OrderView; onChanged: (order: OrderView) => void }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const nextStatus = FULFILMENT_FLOW[FULFILMENT_FLOW.indexOf(order.status) + 1];
  const delivering = nextStatus === 'delivered';

  async function advance(status: OrderStatus, extra: { handoverCode?: string } = {}) {
    setBusy(status);
    setError('');
    try {
      const res = await api<OrderResponse>(`/ops/orders/${order.ref}/status`, { method: 'POST', auth: true, body: { status, ...extra } });
      onChanged(res.order);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }

  async function download() {
    setBusy('download');
    setError('');
    try {
      await downloadFile(`/ops/orders/${order.ref}/file`, order.file.name ?? `${order.ref}.pdf`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }

  return (
    <article className="job">
      <div>
        <h3>
          {order.ref} · {order.title}
        </h3>
        <p>
          {order.options.pages} pp × {order.options.copies} · {order.options.colour === 'colour' ? 'Colour' : 'B&W'} ·{' '}
          {order.options.sides === 'double' ? 'Duplex' : 'Simplex'} · {order.options.paperSize} · {finishingLabel(order.options.finishing)}
        </p>
      </div>
      <div>
        <span className={pillClass(order.status)}>{order.statusLabel}</span>
        <p>
          {order.delivery.recipientName}, {order.delivery.area} · {order.channel === 'express' ? 'Express' : 'Account'} · {formatDate(order.createdAt)}
        </p>
      </div>
      <div className="job__actions">
        <button type="button" className="c-btn c-btn--quiet c-btn--small" onClick={download} disabled={!order.file.available || Boolean(busy)}>
          <Icon.Download width={16} height={16} /> {order.file.available ? 'Download' : 'Erased'}
        </button>
        {nextStatus && !delivering && (
          <button type="button" className="c-btn c-btn--primary c-btn--small" onClick={() => advance(nextStatus)} disabled={Boolean(busy)}>
            {busy === nextStatus ? 'Saving' : `Mark ${statusLabel(nextStatus).toLowerCase()}`}
          </button>
        )}
      </div>
      {delivering && (
        <form
          className="job__deliver"
          onSubmit={(e) => {
            e.preventDefault();
            advance('delivered', { handoverCode: code });
          }}
        >
          <div className="c-field">
            <label htmlFor={`code-${order.ref}`}>Recipient’s handover code</label>
            <input id={`code-${order.ref}`} className="c-input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </div>
          <button type="submit" className="c-btn c-btn--primary" disabled={code.length !== 6 || Boolean(busy)}>
            {busy === 'delivered' ? 'Confirming' : 'Confirm delivery and erase file'}
          </button>
          <p style={{ color: 'var(--c-muted)', fontSize: 13.5, flexBasis: '100%' }}>
            Deliver to: {order.delivery.address}, {order.delivery.area}
            {order.delivery.instructions ? ` · ${order.delivery.instructions}` : ''} · {order.customer?.phone}
          </p>
        </form>
      )}
      {error && <div className="c-alert" role="alert" style={{ gridColumn: '1 / -1' }}>{error}</div>}
    </article>
  );
}

export default function Queue() {
  const [{ loading, data, error }, setState] = useAsync((signal) => api<QueueResponse>('/ops/queue', { auth: true, signal }), []);

  function onChanged(updated: OrderView) {
    setState((s) => ({
      ...s,
      data: {
        items: (s.data?.items ?? [])
          .map((o) => (o.ref === updated.ref ? updated : o))
          .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')
      }
    }));
  }

  return (
    <>
      <PageHead title="Print queue" subtitle="Oldest first. Every download is logged against your name." />
      {error && <div className="c-alert" role="alert">{error}</div>}
      {loading && !data && <p style={{ color: 'var(--c-muted)' }}><span className="spinner" aria-hidden="true" /> Loading queue</p>}
      {data && data.items.length === 0 && (
        <div className="table-wrap">
          <div className="empty">
            <strong>The queue is clear</strong>
            New paid and invoiced orders will appear here.
          </div>
        </div>
      )}
      {data && data.items.length > 0 && (
        <div className="queue">
          {data.items.map((o) => (
            <Job key={o.ref} order={o} onChanged={onChanged} />
          ))}
        </div>
      )}
    </>
  );
}
