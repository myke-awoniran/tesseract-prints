import { formatNaira, type InvoiceView } from '@tesseract/shared';
import { formatDate } from '../lib/format';
import { Link } from '../lib/router';

const METHOD_LABEL: Record<string, string> = { online: 'Online', bank_transfer: 'Bank transfer', other: 'Direct payment' };

export function InvoiceStatus({ invoice }: { invoice: InvoiceView }) {
  if (invoice.status === 'paid') return <span className="inv-status inv-status--paid">Paid</span>;
  if (invoice.status === 'void') return <span className="inv-status inv-status--void">Void</span>;
  if (invoice.overdue) return <span className="inv-status inv-status--overdue">Overdue</span>;
  return <span className="inv-status inv-status--open">Due {formatDate(invoice.dueAt, false)}</span>;
}

/** The invoice itself: who, what period, every order billed and the total. */
export function InvoiceSheet({ invoice, orderLink }: { invoice: InvoiceView; orderLink?: (ref: string) => string }) {
  return (
    <article className="inv" aria-label={`Invoice ${invoice.number}`}>
      <header className="inv__head">
        <div>
          <p className="inv__eyebrow">Invoice · {invoice.period.label}</p>
          <h2 className="inv__number">{invoice.number}</h2>
          <p className="inv__org">{invoice.organization.name}</p>
        </div>
        <InvoiceStatus invoice={invoice} />
      </header>

      <dl className="inv__meta">
        <div>
          <dt>Issued</dt>
          <dd>{formatDate(invoice.issuedAt, false)}</dd>
        </div>
        <div>
          <dt>{invoice.status === 'paid' ? 'Paid' : 'Due'}</dt>
          <dd>{formatDate(invoice.status === 'paid' && invoice.paidAt ? invoice.paidAt : invoice.dueAt, false)}</dd>
        </div>
        {invoice.status === 'paid' && invoice.payment.method && (
          <div>
            <dt>Paid by</dt>
            <dd>
              {METHOD_LABEL[invoice.payment.method] ?? invoice.payment.method}
              {invoice.payment.provider ? ` · ${invoice.payment.provider}` : ''}
            </dd>
          </div>
        )}
        <div>
          <dt>Orders</dt>
          <dd>{invoice.lines.length}</dd>
        </div>
      </dl>

      {invoice.status === 'void' && invoice.voidReason && <p className="inv-pay__bank">Voided: {invoice.voidReason}</p>}

      <div className="inv-scroll">
        <table className="inv-lines">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Document</th>
              <th scope="col" className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.ref}>
                <td className="ref">{orderLink ? <Link to={orderLink(l.ref)}>{l.ref}</Link> : l.ref}</td>
                <td>
                  {l.title}
                  <span className="sub">
                    {formatDate(l.createdAt, false)}
                    {l.placedBy ? ` · ${l.placedBy}` : ''}
                  </span>
                </td>
                <td className="num">{formatNaira(l.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total</td>
              <td className="num">{formatNaira(invoice.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
  );
}
