import { useEffect, useState } from 'react';
import { formatNaira, type OrdersPageResponse } from '@tesseract/shared';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Link } from '../../lib/router';
import { formatDate, pillClass } from '../../lib/format';
import { PageHead } from '../console/ConsoleLayout';
import { jobSummary } from '../../components/ops';
import { useLiveReload } from '../../lib/realtime';

const STATUS_FILTERS = [
  { id: 'active', label: 'In progress' },
  { id: '', label: 'All' },
  { id: 'awaiting_payment', label: 'Unpaid' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' }
];

const CHANNELS = [
  { id: '', label: 'All channels' },
  { id: 'express', label: 'Express' },
  { id: 'enterprise', label: 'Accounts' }
];

export default function OpsOrders() {
  const [status, setStatus] = useState('active');
  const [channel, setChannel] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const live = useLiveReload();
  const [{ loading, data, error }] = useAsync(
    (signal) => {
      const params = new URLSearchParams({ page: String(page) });
      if (status) params.set('status', status);
      if (channel) params.set('channel', channel);
      if (query) params.set('q', query);
      return api<OrdersPageResponse>(`/ops/orders?${params}`, { auth: true, signal });
    },
    [status, channel, query, page, live]
  );

  return (
    <>
      <PageHead title="All orders" subtitle="Every express and account order. Search by reference, customer, phone or area." />

      <div className="toolbar">
        <div className="tabs" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={status === f.id}
              onClick={() => {
                setStatus(f.id);
                setPage(1);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="toolbar__right">
          <label htmlFor="channel" className="visually-hidden">Channel</label>
          <select
            id="channel"
            className="c-input c-input--compact"
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value);
              setPage(1);
            }}
          >
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <div className="search">
            <label htmlFor="ops-search" className="visually-hidden">Search orders</label>
            <input id="ops-search" className="c-input" type="search" placeholder="TP-…, name, email, phone, area" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      {error && <div className="c-alert" role="alert">{error}</div>}
      {loading && !data && <p className="muted-note"><span className="spinner" aria-hidden="true" /> Loading orders</p>}

      {data && data.items.length === 0 && (
        <div className="table-wrap">
          <div className="empty">
            <strong>No orders match</strong>
            Try a different filter or search.
          </div>
        </div>
      )}
      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="c-table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Job</th>
                  <th scope="col">Deliver to</th>
                  <th scope="col">Status</th>
                  <th scope="col">Placed</th>
                  <th scope="col" className="num">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.ref}>
                    <td>
                      <Link to={`/console/ops/orders/${o.ref}`} className="ref">{o.ref}</Link>
                      <div className="muted">{o.channel === 'express' ? 'Express' : 'Account'}</div>
                    </td>
                    <td>
                      {o.customer?.name}
                      <div className="muted">{o.customer?.phone}</div>
                    </td>
                    <td>
                      <span className="clip">{o.title}</span>
                      <div className="muted">{jobSummary(o)}</div>
                    </td>
                    <td>
                      {o.delivery.recipientName}
                      <div className="muted">{o.delivery.area}</div>
                    </td>
                    <td>
                      <span className={pillClass(o.status)}>{o.statusLabel}</span>
                    </td>
                    <td className="muted">{formatDate(o.createdAt)}</td>
                    <td className="num">{formatNaira(o.quote.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span>
              {data.total} {data.total === 1 ? 'order' : 'orders'}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" className="c-btn c-btn--quiet c-btn--small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span>
                Page {data.page} of {data.pages}
              </span>
              <button type="button" className="c-btn c-btn--quiet c-btn--small" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
