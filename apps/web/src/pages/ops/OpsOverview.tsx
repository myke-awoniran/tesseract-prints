import { useState } from 'react';
import { formatNaira, type OpsOverviewResponse } from '@tesseract/shared';
import { api } from '../../lib/api';
import { Link } from '../../lib/router';
import { useSession } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { formatDate, formatNumber } from '../../lib/format';
import { PageHead } from '../console/ConsoleLayout';
import { Icon } from '../../components/Icons';
import { useLiveReload } from '../../lib/realtime';

const STAGE_LINKS: Record<string, string> = {
  queued: '/console/queue',
  printing: '/console/queue',
  sealed: '/console/deliveries',
  out_for_delivery: '/console/deliveries'
};

const ACTION_LABELS: Record<string, string> = {
  file_downloaded: 'Downloaded file',
  status_changed: 'Moved order',
  file_erased: 'Erased file',
  update_posted: 'Posted update',
  rider_assigned: 'Assigned rider',
  email_resent: 'Resent email'
};

const ALERT_LABELS = { expiring: 'File expiring', overdue: 'Overdue', unassigned: 'Needs rider' } as const;

function dayLabel(day: string, short = true): string {
  return new Intl.DateTimeFormat('en-GB', short ? { day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${day}T12:00:00Z`));
}

/** Daily revenue for the last 14 days. One series, so no legend; hover any day for its figures. */
function RevenueChart({ series }: { series: OpsOverviewResponse['series'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...series.map((s) => s.revenue));
  const w = 700;
  const h = 220;
  const pad = { t: 12, b: 26, l: 4, r: 4 };
  const plotH = h - pad.t - pad.b;
  const col = (w - pad.l - pad.r) / series.length;
  const bw = Math.min(28, col * 0.56);
  const total = series.reduce((a, s) => a + s.revenue, 0);
  const active = hover !== null ? series[hover] : null;

  return (
    <div className="ops-chart" onMouseLeave={() => setHover(null)}>
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Revenue per day for the last 14 days, ${formatNaira(total)} in total`} preserveAspectRatio="none">
        {[0, 0.5, 1].map((t) => {
          const y = pad.t + plotH * (1 - t);
          return <line key={t} x1={pad.l} x2={w - pad.r} y1={y} y2={y} style={{ stroke: 'var(--c-line)' }} strokeWidth="1" />;
        })}
        {series.map((s, i) => {
          const bh = (plotH * s.revenue) / max;
          const x = pad.l + i * col + (col - bw) / 2;
          const y = pad.t + plotH - bh;
          const r = Math.min(4, bh / 2, bw / 2);
          const isToday = i === series.length - 1;
          const fill = isToday || hover === i ? 'var(--c-chart-bar-current)' : 'var(--c-chart-bar)';
          return (
            <g key={s.day}>
              {bh > 0 && (
                <path
                  d={`M${x},${pad.t + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${pad.t + plotH} Z`}
                  style={{ fill }}
                />
              )}
              {(i % 2 === series.length % 2 || isToday) && (
                <text x={x + bw / 2} y={h - 8} textAnchor="middle">
                  {isToday ? 'Today' : dayLabel(s.day)}
                </text>
              )}
              <rect
                x={pad.l + i * col}
                y={0}
                width={col}
                height={h}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={0}
                aria-label={`${dayLabel(s.day, false)}: ${formatNaira(s.revenue)} from ${s.orders} orders`}
              />
            </g>
          );
        })}
      </svg>
      {active && hover !== null && (
        <div className="ops-tip" style={{ left: `${((hover + 0.5) / series.length) * 100}%` }} role="status">
          <strong>{formatNaira(active.revenue)}</strong>
          <span>
            {active.orders} {active.orders === 1 ? 'order' : 'orders'} · {dayLabel(active.day, false)}
          </span>
        </div>
      )}
    </div>
  );
}

export default function OpsOverview() {
  const { user } = useSession();
  const live = useLiveReload({ invoices: true });
  const [{ loading, data, error }] = useAsync((signal) => api<OpsOverviewResponse>('/ops/overview', { auth: true, signal }), [live]);
  const firstName = user.name.split(' ')[0] ?? user.name;
  const zoneMax = data ? Math.max(1, ...data.byZone.map((z) => z.orders)) : 1;
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' }).format(new Date());

  return (
    <>
      <PageHead title={`Good day, ${firstName}`} subtitle={`Print room · ${today}`}>
        <Link to="/console/queue" className="c-btn c-btn--primary">
          <Icon.Printer width={18} height={18} /> Open print queue
        </Link>
      </PageHead>

      {error && <div className="c-alert" role="alert">{error}</div>}
      {loading && !data && <p className="muted-note"><span className="spinner" aria-hidden="true" /> Loading the print room</p>}

      {data && (
        <>
          <div className="pipeline" aria-label="Orders in progress by stage">
            {data.pipeline.map((p, i) => (
              <Link key={p.status} to={STAGE_LINKS[p.status]} className={`pipeline__stage${p.count ? ' has-work' : ''}`}>
                <span className="pipeline__step">{i + 1}</span>
                <strong>{p.count}</strong>
                <span>{p.label}</span>
                {i < data.pipeline.length - 1 && <Icon.ArrowRight className="pipeline__arrow" width={18} height={18} />}
              </Link>
            ))}
          </div>

          {data.alerts.length > 0 && (
            <section className="panel alerts" aria-labelledby="alerts-title">
              <div className="panel__head">
                <h2 id="alerts-title">Needs attention</h2>
                <span>{data.alerts.length}</span>
              </div>
              <ul>
                {data.alerts.map((a) => (
                  <li key={`${a.kind}-${a.ref}`}>
                    <span className={`flag flag--${a.kind}`}>
                      {a.kind === 'expiring' ? <Icon.Clock width={14} height={14} /> : a.kind === 'unassigned' ? <Icon.Seal width={14} height={14} /> : <Icon.Pause width={14} height={14} />}
                      {ALERT_LABELS[a.kind]}
                    </span>
                    <Link to={`/console/ops/orders/${a.ref}`} className="ref">{a.ref}</Link>
                    <span className="alerts__title">{a.title}</span>
                    <span className="alerts__detail">{a.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <dl className="figures">
            <div className="figure">
              <dt>Revenue today</dt>
              <dd style={{ fontSize: 30 }}>{formatNaira(data.today.revenue)}</dd>
              <small>
                {formatNumber(data.today.received)} received · {formatNumber(data.today.delivered)} delivered
              </small>
            </div>
            <div className="figure">
              <dt>Revenue this month</dt>
              <dd style={{ fontSize: 30 }}>{formatNaira(data.month.revenue)}</dd>
              <small>
                {formatNaira(data.month.expressRevenue)} express · {formatNaira(data.month.invoiced)} invoiced
              </small>
            </div>
            <div className="figure">
              <dt>Pages this month</dt>
              <dd>{formatNumber(data.month.pages)}</dd>
              <small>{formatNumber(data.month.orders)} orders</small>
            </div>
            <div className="figure">
              <dt>Average turnaround</dt>
              <dd>{data.turnaroundHours === null ? '—' : data.turnaroundHours < 1 ? '<1h' : `${data.turnaroundHours}h`}</dd>
              <small>Order to handover, last 30 days</small>
            </div>
          </dl>

          <div className="grid-2 grid-2--wide">
            <section className="panel" aria-labelledby="rev-title">
              <div className="panel__head">
                <h2 id="rev-title">Revenue, last 14 days</h2>
                <span>{formatNaira(data.series.reduce((a, s) => a + s.revenue, 0))}</span>
              </div>
              <RevenueChart series={data.series} />
            </section>
            <section className="panel" aria-labelledby="zone-title">
              <div className="panel__head">
                <h2 id="zone-title">Deliveries by zone</h2>
                <span>This month</span>
              </div>
              <div className="breakdown">
                {data.byZone.map((z) => (
                  <div key={z.zone} className="breakdown__row">
                    <span>{z.label}</span>
                    <span>{z.orders}</span>
                    <div className="breakdown__bar">
                      <span style={{ width: `${(z.orders / zoneMax) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {data.awaitingPayment > 0 && (
                <p className="muted-note" style={{ marginTop: 18 }}>
                  {data.awaitingPayment} express {data.awaitingPayment === 1 ? 'checkout was' : 'checkouts were'} started but not paid in the last 24 hours.
                </p>
              )}
            </section>
          </div>

          <section className="panel" style={{ marginTop: 20 }} aria-labelledby="activity-title">
            <div className="panel__head">
              <h2 id="activity-title">Recent activity</h2>
              <Link to="/console/ops/orders">All orders</Link>
            </div>
            {data.activity.length === 0 ? (
              <p className="muted-note">Nothing yet. Activity on orders appears here.</p>
            ) : (
              <ol className="activity">
                {data.activity.map((a, i) => (
                  <li key={i}>
                    <span className="activity__who">{a.by}</span>
                    <span>
                      {ACTION_LABELS[a.action] ?? a.action}
                      {a.ref && (
                        <>
                          {' '}
                          <Link to={`/console/ops/orders/${a.ref}`} className="ref">{a.ref}</Link>
                        </>
                      )}
                      {a.detail && <small> · {a.detail.replace(/_/g, ' ')}</small>}
                    </span>
                    <time dateTime={a.at}>{formatDate(a.at)}</time>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </>
  );
}
