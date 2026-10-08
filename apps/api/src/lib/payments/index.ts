import { config, type PaymentProviderId } from '../../config.js';
import { bachsGateway } from './bachs.js';
import { paystackGateway } from './paystack.js';
import type { OrderDocument } from '../../models/Order.js';
import type { InvoiceDocument } from '../../models/Invoice.js';
import type { Charge, ChargeAttempt, PaymentGateway } from './types.js';

export type { Charge, ChargeAttempt, PaymentGateway } from './types.js';

const gateways: Record<PaymentProviderId, PaymentGateway> = {
  bachs: bachsGateway,
  paystack: paystackGateway
};

/** Where new checkouts go. Switch with PAYMENT_PROVIDER. */
export const activeGateway: PaymentGateway = gateways[config.payments.provider];

/** The gateway an order's checkout was started on. Orders from before providers were recorded used Paystack. */
export function gatewayForOrder(provider: string | null | undefined): PaymentGateway | null {
  const id = provider || 'paystack';
  return id in gateways ? gateways[id as PaymentProviderId] : null;
}

export function gatewayLabel(provider: string | null | undefined): string | null {
  if (!provider) return null;
  if (provider === 'mock') return 'Mock (development)';
  if (provider === 'invoice') return 'Invoice';
  return provider in gateways ? gateways[provider as PaymentProviderId].label : provider;
}

export function orderCharge(order: OrderDocument): Charge {
  return { owner: { kind: 'order', ref: order.ref }, amountKobo: order.quote.total, email: order.customer.email, name: order.customer.name };
}

export function invoiceCharge(invoice: InvoiceDocument): Charge {
  return {
    owner: { kind: 'invoice', number: invoice.number },
    amountKobo: invoice.total,
    email: invoice.billingEmail,
    name: invoice.organizationName
  };
}

export function attemptOf(payment: { reference?: string | null; checkoutId?: string | null }): ChargeAttempt {
  return { reference: payment.reference ?? null, checkoutId: payment.checkoutId ?? null };
}
