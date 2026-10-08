import type { PaymentProviderId } from '../../config.js';

/** What a checkout is for. The gateway stores it on the checkout so a payment can be traced back. */
export type ChargeOwner = { kind: 'order'; ref: string } | { kind: 'invoice'; number: string };

/** Something to collect: an express order or an organisation's monthly invoice. */
export interface Charge {
  owner: ChargeOwner;
  amountKobo: number;
  email: string;
  name: string;
}

export interface CheckoutInput {
  /** Our reference for this attempt, unique per attempt. */
  reference: string;
  /** Where the customer lands after paying. Each gateway adds its own query parameters. */
  returnUrl: string;
  /** Where the customer lands if they back out of the payment page. */
  cancelUrl: string;
}

export interface CheckoutStart {
  url: string;
  /** The gateway's own id for the checkout, when it differs from our reference. */
  checkoutId: string | null;
}

/** The latest checkout started for a charge. */
export interface ChargeAttempt {
  reference: string | null;
  checkoutId: string | null;
}

export interface PaymentCheck {
  paid: boolean;
  status: string;
}

export interface PaymentGateway {
  id: PaymentProviderId;
  label: string;
  configured: boolean;
  startCheckout(charge: Charge, input: CheckoutInput): Promise<CheckoutStart>;
  /** Asks the gateway whether the charge's latest checkout was paid in full. */
  checkPayment(charge: Charge, attempt: ChargeAttempt): Promise<PaymentCheck>;
}

/** Metadata stored on every checkout, keyed so a webhook can tell orders and invoices apart. */
export function ownerMetadata(owner: ChargeOwner): Record<string, string> {
  return owner.kind === 'order' ? { order_ref: owner.ref } : { invoice_number: owner.number };
}
