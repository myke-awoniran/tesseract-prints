import type { FastifyBaseLogger } from 'fastify';
import type { OrderDocument } from '../../models/Order.js';
import type { InvoiceDocument } from '../../models/Invoice.js';
import { markPaid } from '../orders.js';
import { markInvoicePaid } from '../invoices.js';
import { attemptOf, gatewayForOrder, invoiceCharge, orderCharge, type Charge, type ChargeAttempt } from './index.js';

const MIN_INTERVAL_MS = 15_000;
const lastChecked = new Map<string, number>();

/**
 * Asks the gateway whether a charge has been paid, at most every 15 seconds per charge.
 * A safety net for a webhook that is late, misconfigured, or cannot reach the server (local development).
 */
async function reconcile(
  key: string,
  provider: string | null | undefined,
  charge: Charge,
  attempt: ChargeAttempt,
  onPaid: (provider: string) => Promise<unknown>,
  log: FastifyBaseLogger
): Promise<boolean> {
  if (!attempt.reference) return false;
  const gateway = gatewayForOrder(provider);
  if (!gateway?.configured) return false;

  const now = Date.now();
  if (now - (lastChecked.get(key) ?? 0) < MIN_INTERVAL_MS) return false;
  if (lastChecked.size > 10_000) lastChecked.clear();
  lastChecked.set(key, now);

  try {
    const check = await gateway.checkPayment(charge, attempt);
    if (!check.paid) return false;
    await onPaid(gateway.id);
    log.info({ owner: charge.owner, provider: gateway.id }, 'payment confirmed by reconciliation');
    return true;
  } catch (err) {
    log.warn({ err, owner: charge.owner }, 'payment reconciliation failed');
    return false;
  }
}

export function reconcilePayment(order: OrderDocument, log: FastifyBaseLogger): Promise<boolean> {
  if (order.status !== 'awaiting_payment') return Promise.resolve(false);
  return reconcile(`order:${order._id}`, order.payment.provider, orderCharge(order), attemptOf(order.payment), (p) => markPaid(order._id, p), log);
}

export function reconcileInvoice(invoice: InvoiceDocument, log: FastifyBaseLogger): Promise<boolean> {
  if (invoice.status !== 'open' || !invoice.payment.provider) return Promise.resolve(false);
  const attempt = attemptOf(invoice.payment);
  return reconcile(
    `invoice:${invoice._id}`,
    invoice.payment.provider,
    invoiceCharge(invoice),
    attempt,
    (provider) => markInvoicePaid(invoice._id, { method: 'online', provider, ...attempt }),
    log
  );
}
