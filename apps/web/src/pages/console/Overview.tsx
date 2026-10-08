import { api } from '../../lib/api';
import { Link } from '../../lib/router';
import { useSession } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { formatDate, formatNumber, pillClass } from '../../lib/format';
import { formatNaira, type OrderView, type StatsResponse } from '@tesseract/shared';
import { PageHead } from './ConsoleLayout';
import { Icon } from '../../components/Icons';
import { useLiveReload } from '../../lib/realtime';

function BarChart({ series }: { series: StatsResponse['series'] }) {
  const max = Math.max(1, ...series.map((s) => s.orders));
  const w = 600;
  const h = 240;
  const pad = { t: 16, b: 28, l: 8, r: 8 };
  const bw = (w - pad.l - pad.r) / series.length;
  const ticks = [0, Math.ceil(max / 2), max];
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Orders per month: ${series.map((s) => `${s.month} ${s.orders}`).join(', ')}`} preserveAspectRatio="none">
      {ticks.map((t, i) => {
        const y = pad.t + (h - pad.t - pad.b) * (1 - t / max);
        return <line key={i} x1={pad.l} x2={w - pad.r} y1={y} y2={y} style={{ stroke: 'var(--c-line)' }} strokeWidth="1" />;
      })}
      {series.map((s, i) => {
        const bh = ((h - pad.t - pad.b) * s.orders) / max;
        const x = pad.l + i * bw + bw * 0.28;
        const y = h - pad.b - bh;
        const last = i === series.length - 1;
        return (
          <g key={s.month}>
            <rect x={x} y={y} width={bw * 0.44} height={Math.max(bh, s.orders ? 2 : 0)} rx="3" style={{ fill: last ? 'var(--c-chart-bar-current)' : 'var(--c-chart-bar)' }} />
            {s.orders > 0 && (
              <text x={x + bw * 0.22} y={y - 6} textAnchor="middle" style={{ fill: 'var(--c-lilac)' }}>
                {s.orders}
              </text>
            )}
            <text x={x + bw * 0.22} y={h - 8} textAnchor="middle">
              {s.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Overview() {
  const { user, organization } = useSession();
  const live = useLiveReload();
  const [{ loading, data, error }] = useAsync((signal) => api<StatsResponse>('/enterprise/stats', { auth: true, signal }), [live]);
  const firstName = user.name.split(' ')[0] ?? user.name;
  const maxStatus = data ? Math.max(1, ...data.byStatus.map((b) => b.count)) : 1;

  return (
    <>
      <PageHead title={`Good to see you, ${firstName}`} subtitle={`${organization?.name ?? 'Your organisation'} · activity at a glance`}>
        <Link to="/console/orders/new" className="c-btn c-btn--primary">
          <Icon.Plus width={18} height={18} /> New order
        </Link>
      </PageHead>

      {error && <div className="c-alert" role="alert">{error}</div>}
      {loading && !data && <p style={{ color: 'var(--c-muted)' }}><span className="spinner" aria-hidden="true" /> Loading activity</p>}

      {data && (
        <>
          <dl className="figures">
            <div className="figure">
              <dt>Orders this month</dt>
              <dd>{formatNumber(data.totals.thisMonth)}</dd>
              <small>{formatNumber(data.totals.total)} all time</small>
            </div>
            <div className="figure">
              <dt>In progress</dt>
              <dd>{formatNumber(data.totals.inProgress)}</dd>
              <small>Received to out for delivery</small>
            </div>
            <div className="figure">
              <dt>Pages this month</dt>
              <dd>{formatNumber(data.totals.pagesThisMonth)}</dd>
              <small>Across all copies</small>
            </div>
            <div className="figure">
              <dt>Invoiced this month</dt>
              <dd style={{ fontSize: 30 }}>{formatNaira(data.totals.invoicedThisMonth)}</dd>
              <small>{formatNumber(data.totals.delivered)} orders delivered all time</small>
            </div>
          </dl>

          <div className="grid-2">
            <section className="panel" aria-labelledby="chart-title">
              <div className="panel__head">
                <h2 id="chart-title">Orders, last six months</h2>
                <span>{formatNumber(data.series.reduce((a, s) => a + s.pages, 0))} pages</span>
              </div>
              <BarChart series={data.series} />
            </section>
            <section className="panel" aria-labelledby="status-title">
              <div className="panel__head">
                <h2 id="status-title">By status</h2>
              </div>
              <div className="breakdown">
                {data.byStatus.map((b) => (
                  <div key={b.status} className="breakdown__row">
                    <span>{b.label}</span>
                    <span>{b.count}</span>
                    <div className="breakdown__bar">
                      <span style={{ width: `${(b.count / maxStatus) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="panel" style={{ marginTop: 20 }} aria-labelledby="recent-title">
            <div className="panel__head">
              <h2 id="recent-title">Recent orders</h2>
              <Link to="/console/orders">View all</Link>
            </div>
            {data.recent.length === 0 ? (
              <div className="empty">
                <strong>No orders yet</strong>
                Place your first order and it will appear here.
                <div style={{ marginTop: 18 }}>
                  <Link to="/console/orders/new" className="c-btn c-btn--primary">Place an order</Link>
                </div>
              </div>
            ) : (
              <OrdersTable orders={data.recent} />
            )}
          </section>
        </>
      )}
    </>
  );
}

export function OrdersTable({ orders }: { orders: OrderView[] }) {
  return (
    <div className="table-wrap">
      <table className="c-table">
        <thead>
          <tr>
            <th scope="col">Reference</th>
            <th scope="col">Document</th>
            <th scope="col">Recipient</th>
            <th scope="col">Status</th>
            <th scope="col">Placed</th>
            <th scope="col" className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.ref}>
              <td>
                <Link to={`/console/orders/${o.ref}`} className="ref">{o.ref}</Link>
              </td>
              <td>
                {o.title}
                <div className="muted">
                  {o.options.pages} pp · {o.options.copies} {o.options.copies === 1 ? 'copy' : 'copies'}
                </div>
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
  );
}
