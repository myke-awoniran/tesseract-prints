import { formatNaira, type ClientsResponse } from '@tesseract/shared';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { formatDate, formatNumber } from '../../lib/format';
import { PageHead } from '../console/ConsoleLayout';

export default function Clients() {
  const [{ loading, data, error }] = useAsync((signal) => api<ClientsResponse>('/ops/clients', { auth: true, signal }), []);
  const accountSpend = data?.clients.reduce((a, c) => a + c.spend, 0) ?? 0;
  const accountMonth = data?.clients.reduce((a, c) => a + c.spendThisMonth, 0) ?? 0;

  return (
    <>
      <PageHead title="Clients" subtitle="Account organisations, ranked by lifetime spend, and express customers in total." />
      {error && <div className="c-alert" role="alert">{error}</div>}
      {loading && !data && <p className="muted-note"><span className="spinner" aria-hidden="true" /> Loading clients</p>}
      {data && (
        <>
          <dl className="figures">
            <div className="figure">
              <dt>Account clients</dt>
              <dd>{formatNumber(data.clients.length)}</dd>
              <small>{formatNumber(data.clients.reduce((a, c) => a + c.members, 0))} people with console access</small>
            </div>
            <div className="figure">
              <dt>Invoiced this month</dt>
              <dd style={{ fontSize: 30 }}>{formatNaira(accountMonth)}</dd>
              <small>{formatNaira(accountSpend)} all time</small>
            </div>
            <div className="figure">
              <dt>Express customers</dt>
              <dd>{formatNumber(data.express.customers)}</dd>
              <small>{formatNumber(data.express.orders)} paid orders</small>
            </div>
            <div className="figure">
              <dt>Express revenue</dt>
              <dd style={{ fontSize: 30 }}>{formatNaira(data.express.revenue)}</dd>
              <small>All time, excluding cancellations</small>
            </div>
          </dl>

          {data.clients.length === 0 ? (
            <div className="table-wrap">
              <div className="empty">
                <strong>No account clients yet</strong>
                Organisations you onboard appear here with their order history.
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="c-table">
                <thead>
                  <tr>
                    <th scope="col">Organisation</th>
                    <th scope="col" className="num">People</th>
                    <th scope="col" className="num">Orders</th>
                    <th scope="col" className="num">In progress</th>
                    <th scope="col">Last order</th>
                    <th scope="col" className="num">This month</th>
                    <th scope="col" className="num">Lifetime</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clients.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong className="strong">{c.name}</strong>
                        <div className="muted">{c.billingEmail || 'No billing email set'}</div>
                      </td>
                      <td className="num">{c.members}</td>
                      <td className="num">{formatNumber(c.orders)}</td>
                      <td className="num">{c.inProgress || <span className="muted">0</span>}</td>
                      <td className="muted">{c.lastOrderAt ? formatDate(c.lastOrderAt, false) : 'Never'}</td>
                      <td className="num">{formatNaira(c.spendThisMonth)}</td>
                      <td className="num">{formatNaira(c.spend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
