import { useEffect, useState } from 'react';
import type { OrdersPageResponse } from '@tesseract/shared';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Link } from '../../lib/router';
import { PageHead } from './ConsoleLayout';
import { OrdersTable } from './Overview';
import { Icon } from '../../components/Icons';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'active', label: 'In progress' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' }
];

export default function Orders() {
  const [status, setStatus] = useState('');
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

  const [{ loading, data, error }] = useAsync((signal) => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set('status', status);
    if (query) params.set('q', query);
    return api<OrdersPageResponse>(`/enterprise/orders?${params}`, { auth: true, signal });
  }, [status, query, page]);

  return (
    <>
      <PageHead title="Orders" subtitle="Everything your organisation has sent to print.">
        <Link to="/console/orders/new" className="c-btn c-btn--primary">
          <Icon.Plus width={18} height={18} /> New order
        </Link>
      </PageHead>

      <div className="toolbar">
        <div className="tabs" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
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
        <div className="search">
          <label htmlFor="order-search" className="visually-hidden">Search orders</label>
          <input id="order-search" className="c-input" type="search" placeholder="Search by reference, document or recipient" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {error && <div className="c-alert" role="alert">{error}</div>}
      {loading && !data && <p style={{ color: 'var(--c-muted)' }}><span className="spinner" aria-hidden="true" /> Loading orders</p>}

      {data && data.items.length === 0 && (
        <div className="table-wrap">
          <div className="empty">
            <strong>{query || status ? 'No orders match' : 'No orders yet'}</strong>
            {query || status ? 'Try a different filter or search.' : 'Orders you place will be listed here.'}
          </div>
        </div>
      )}
      {data && data.items.length > 0 && (
        <>
          <OrdersTable orders={data.items} />
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
