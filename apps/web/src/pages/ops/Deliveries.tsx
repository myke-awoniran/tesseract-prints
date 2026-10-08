import { useState } from 'react';
import type { OrderView, QueueResponse } from '@tesseract/shared';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Link } from '../../lib/router';
import { PageHead } from '../console/ConsoleLayout';
import { Icon } from '../../components/Icons';
import { DeliverForm, RiderForm, UpdateComposer, UpdatesFeed, age, formatTime, jobSummary } from '../../components/ops';
import { useLiveReload } from '../../lib/realtime';

function Address({ order }: { order: OrderView }) {
  return (
    <div className="drop-to">
      <strong>{order.delivery.recipientName}</strong>
      <span>
        {order.delivery.address}, {order.delivery.area}
      </span>
      {order.delivery.instructions && <em>“{order.delivery.instructions}”</em>}
      {order.customer?.phone && (
        <a href={`tel:${order.customer.phone.replace(/[^\d+]/g, '')}`}>
          <Icon.Phone width={14} height={14} /> {order.customer.phone}
        </a>
      )}
    </div>
  );
}

function ReadyCard({ order, onChanged }: { order: OrderView; onChanged: (o: OrderView) => void }) {
  return (
    <article className="dcard">
      <header>
        <Link to={`/console/ops/orders/${order.ref}`} className="ref">{order.ref}</Link>
        <span className="muted">Sealed {age(order.timeline.find((t) => t.status === 'sealed')?.at ?? order.createdAt)} ago</span>
      </header>
      <h3>{order.title}</h3>
      <p className="muted">{jobSummary(order)}</p>
      <Address order={order} />
      <RiderForm order={order} sendOut onDone={onChanged} />
    </article>
  );
}

function RoadCard({ order, onChanged }: { order: OrderView; onChanged: (o: OrderView) => void }) {
  const [tab, setTab] = useState<'update' | 'deliver' | 'rider'>('update');
  const late = order.dispatch?.eta && new Date(order.dispatch.eta).getTime() < Date.now();
  return (
    <article className="dcard dcard--road">
      <header>
        <Link to={`/console/ops/orders/${order.ref}`} className="ref">{order.ref}</Link>
        {order.dispatch?.eta && <span className={late ? 'eta is-late' : 'eta'}>{late ? 'Due' : 'ETA'} {formatTime(order.dispatch.eta)}</span>}
      </header>
      <h3>{order.title}</h3>
      {order.dispatch && (
        <div className="rider">
          <span className="avatar" aria-hidden="true">
            {order.dispatch.riderName
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0])
              .join('')
              .toUpperCase()}
          </span>
          <div>
            <strong>{order.dispatch.riderName}</strong>
            <a href={`tel:${order.dispatch.riderPhone.replace(/[^\d+]/g, '')}`}>{order.dispatch.riderPhone}</a>
          </div>
          <span className="muted">Out {age(order.dispatch.assignedAt)}</span>
        </div>
      )}
      <Address order={order} />
      <div className="subtabs" role="tablist" aria-label="Actions">
        {(
          [
            ['update', 'Post update'],
            ['deliver', 'Confirm handover'],
            ['rider', 'Change rider']
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'update' && (
        <>
          <UpdateComposer order={order} onDone={onChanged} />
          {order.updates.length > 0 && <UpdatesFeed updates={order.updates.slice(-2)} />}
        </>
      )}
      {tab === 'deliver' && <DeliverForm order={order} onDone={onChanged} />}
      {tab === 'rider' && <RiderForm order={order} onDone={(o) => { onChanged(o); setTab('update'); }} />}
    </article>
  );
}

export default function Deliveries() {
  const live = useLiveReload({ order: (o) => ['sealed', 'out_for_delivery', 'delivered'].includes(o.status) || Boolean(o.dispatch) });
  const [{ loading, data, error }, setState] = useAsync((signal) => api<QueueResponse>('/ops/deliveries', { auth: true, signal }), [live]);
  const [delivered, setDelivered] = useState<string[]>([]);

  function onChanged(updated: OrderView) {
    if (updated.status === 'delivered') setDelivered((d) => [updated.ref, ...d].slice(0, 3));
    setState((s) => ({
      ...s,
      data: { items: (s.data?.items ?? []).map((o) => (o.ref === updated.ref ? updated : o)).filter((o) => o.status === 'sealed' || o.status === 'out_for_delivery') }
    }));
  }

  const ready = data?.items.filter((o) => o.status === 'sealed') ?? [];
  const road = data?.items.filter((o) => o.status === 'out_for_delivery') ?? [];

  return (
    <>
      <PageHead title="Deliveries" subtitle="Assign riders, keep customers posted, and confirm every handover with its code." />
      {error && <div className="c-alert" role="alert">{error}</div>}
      {delivered.length > 0 && (
        <div className="c-alert c-alert--ok" role="status">
          {delivered.join(', ')} delivered. Files erased and receipts emailed.
        </div>
      )}
      {loading && !data && <p className="muted-note"><span className="spinner" aria-hidden="true" /> Loading deliveries</p>}
      {data && (
        <div className="board">
          <section aria-labelledby="col-ready">
            <h2 id="col-ready" className="board__head">
              Ready to dispatch <span>{ready.length}</span>
            </h2>
            {ready.length === 0 ? (
              <div className="board__empty">Sealed orders appear here, ready for a rider.</div>
            ) : (
              ready.map((o) => <ReadyCard key={o.ref} order={o} onChanged={onChanged} />)
            )}
          </section>
          <section aria-labelledby="col-road">
            <h2 id="col-road" className="board__head">
              On the road <span>{road.length}</span>
            </h2>
            {road.length === 0 ? (
              <div className="board__empty">Nothing out for delivery right now.</div>
            ) : (
              road.map((o) => <RoadCard key={o.ref} order={o} onChanged={onChanged} />)
            )}
          </section>
        </div>
      )}
    </>
  );
}
