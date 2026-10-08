import { useState } from 'react';
import { FULFILMENT_FLOW, statusLabel, finishingLabel, type OrderResponse, type OrderStatus, type OrderView, type QueueResponse } from '@tesseract/shared';
import { api, downloadFile, errorMessage } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Link } from '../../lib/router';
import { pillClass } from '../../lib/format';
import { PageHead } from './ConsoleLayout';
import { Icon } from '../../components/Icons';
import { age, jobSummary } from '../../components/ops';
import { useLiveReload } from '../../lib/realtime';

function expiresIn(o: OrderView): { text: string; urgent: boolean } | null {
  if (!o.file.available || !o.file.expiresAt) return null;
  const mins = Math.round((new Date(o.file.expiresAt).getTime() - Date.now()) / 60000);
  if (mins <= 0) return { text: 'File expired', urgent: true };
  const text = mins < 60 ? `File erased in ${mins}m` : `File erased in ${Math.floor(mins / 60)}h ${mins % 60}m`;
  return { text, urgent: mins < 240 };
}

function Job({ order, onChanged }: { order: OrderView; onChanged: (order: OrderView) => void }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const nextStatus = FULFILMENT_FLOW[FULFILMENT_FLOW.indexOf(order.status) + 1];
  const expiry = expiresIn(order);

  async function advance(status: OrderStatus) {
    setBusy(status);
    setError('');
    try {
      const res = await api<OrderResponse>(`/ops/orders/${order.ref}/status`, { method: 'POST', auth: true, body: { status } });
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
          <Link to={`/console/ops/orders/${order.ref}`} className="ref">{order.ref}</Link> · {order.title}
        </h3>
        <p>
          {jobSummary(order)} · {finishingLabel(order.options.finishing)}
        </p>
        <p className="job__meta">
          <span className={`tag${order.channel === 'enterprise' ? ' tag--account' : ''}`}>{order.channel === 'express' ? 'Express' : 'Account'}</span>
          <span>{order.delivery.area}</span>
          <span>Waiting {age(order.createdAt)}</span>
          {expiry && <span className={expiry.urgent ? 'is-urgent' : undefined}>{expiry.text}</span>}
        </p>
      </div>
      <div>
        <span className={pillClass(order.status)}>{order.statusLabel}</span>
      </div>
      <div className="job__actions">
        <button type="button" className="c-btn c-btn--quiet c-btn--small" onClick={download} disabled={!order.file.available || Boolean(busy)}>
          <Icon.Download width={16} height={16} /> {order.file.available ? 'Download' : 'Erased'}
        </button>
        {nextStatus && (
          <button type="button" className="c-btn c-btn--primary c-btn--small" onClick={() => advance(nextStatus)} disabled={Boolean(busy)}>
            {busy === nextStatus ? 'Saving' : `Mark ${statusLabel(nextStatus).toLowerCase()}`}
          </button>
        )}
      </div>
      {error && <div className="c-alert" role="alert" style={{ gridColumn: '1 / -1' }}>{error}</div>}
    </article>
  );
}

export default function Queue() {
  const live = useLiveReload({ order: (o) => ['queued', 'printing', 'sealed'].includes(o.status) });
  const [{ loading, data, error }, setState] = useAsync((signal) => api<QueueResponse>('/ops/queue', { auth: true, signal }), [live]);
  const [justSealed, setJustSealed] = useState<string[]>([]);

  function onChanged(updated: OrderView) {
    if (updated.status === 'sealed') setJustSealed((s) => [updated.ref, ...s].slice(0, 3));
    setState((s) => ({
      ...s,
      data: {
        items: (s.data?.items ?? []).map((o) => (o.ref === updated.ref ? updated : o)).filter((o) => o.status === 'queued' || o.status === 'printing')
      }
    }));
  }

  const queued = data?.items.filter((o) => o.status === 'queued') ?? [];
  const printing = data?.items.filter((o) => o.status === 'printing') ?? [];

  return (
    <>
      <PageHead title="Print queue" subtitle="Oldest first. Every download is logged against your name.">
        <Link to="/console/deliveries" className="c-btn c-btn--quiet">
          Deliveries <Icon.ArrowRight width={16} height={16} />
        </Link>
      </PageHead>
      {error && <div className="c-alert" role="alert">{error}</div>}
      {justSealed.length > 0 && (
        <div className="c-alert c-alert--ok" role="status">
          {justSealed.join(', ')} sealed and moved to <Link to="/console/deliveries">Deliveries</Link> for dispatch.
        </div>
      )}
      {loading && !data && <p className="muted-note"><span className="spinner" aria-hidden="true" /> Loading queue</p>}
      {data && data.items.length === 0 && (
        <div className="table-wrap">
          <div className="empty">
            <strong>The queue is clear</strong>
            New paid and invoiced orders will appear here.
          </div>
        </div>
      )}
      {printing.length > 0 && (
        <section className="lane" aria-labelledby="lane-printing">
          <h2 id="lane-printing">
            On the press <span>{printing.length}</span>
          </h2>
          <div className="queue">
            {printing.map((o) => (
              <Job key={o.ref} order={o} onChanged={onChanged} />
            ))}
          </div>
        </section>
      )}
      {queued.length > 0 && (
        <section className="lane" aria-labelledby="lane-queued">
          <h2 id="lane-queued">
            Waiting to print <span>{queued.length}</span>
          </h2>
          <div className="queue">
            {queued.map((o) => (
              <Job key={o.ref} order={o} onChanged={onChanged} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
