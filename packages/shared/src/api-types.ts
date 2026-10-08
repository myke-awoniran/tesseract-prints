// Request and response shapes for the HTTP API. The server returns these; the web app consumes them.
import type {
  Colour,
  FinishingId,
  InvoicePaymentMethod,
  InvoiceStatus,
  OrderChannel,
  OrderStatus,
  PaymentStatus,
  PrintOptions,
  Quote,
  Role,
  ZoneId
} from './domain.js';

export type ISODateString = string;

export interface ApiErrorBody {
  error: string;
  /** Field-level messages keyed by field name, or a list of schema messages. */
  details?: Record<string, string> | string[];
}

export interface TimelineEntryView {
  status: OrderStatus;
  label: string;
  at: ISODateString;
  note: string;
}

/** A note about the delivery that the customer can see, e.g. "Rider is 10 minutes away". */
export interface DeliveryUpdateView {
  id: string;
  at: ISODateString;
  message: string;
  by: string;
}

export interface DispatchView {
  riderName: string;
  riderPhone: string;
  eta?: ISODateString;
  assignedAt: ISODateString;
}

export interface OrderView {
  ref: string;
  channel: OrderChannel;
  title: string;
  status: OrderStatus;
  statusLabel: string;
  timeline: TimelineEntryView[];
  options: PrintOptions;
  quote: Quote;
  /** `provider` is the gateway's display name, included on internal views only. */
  payment: { status: PaymentStatus; paidAt?: ISODateString; provider?: string };
  delivery: {
    recipientName: string;
    area: string;
    zone: ZoneId;
    address?: string;
    instructions?: string;
  };
  file: {
    name?: string;
    size?: number;
    available: boolean;
    expiresAt?: ISODateString;
    erasedAt?: ISODateString;
  };
  createdAt: ISODateString;
  deliveredAt?: ISODateString;
  /** The rider carrying the order, once one is assigned. */
  dispatch?: DispatchView;
  updates: DeliveryUpdateView[];
  /** Present for operators only. */
  customer?: { name: string; email: string; phone: string };
  /** Present while the order is undelivered, for people entitled to see it. */
  handoverCode?: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  organization: string | null;
  lastLoginAt?: ISODateString;
}

export interface OrganizationSummary {
  id: string;
  name: string;
}

export interface DefaultDelivery {
  recipientName: string;
  phone: string;
  address: string;
  area: string;
}

export interface OrganizationPreferences {
  notifyOnDispatch: boolean;
  notifyOnDelivery: boolean;
  defaultFinishing: FinishingId;
  defaultColour: Colour;
}

export interface OrganizationView extends OrganizationSummary {
  billingEmail: string;
  defaultDelivery: DefaultDelivery;
  preferences: OrganizationPreferences;
}

/* Auth */
export interface LoginRequest {
  email: string;
  password: string;
}
export interface SessionResponse {
  user: PublicUser;
  organization: OrganizationSummary | null;
}
export interface LoginResponse extends SessionResponse {
  token: string;
}

/* Express */
export interface CreateExpressOrderResponse {
  order: OrderView;
  accessToken: string;
}
export interface PayRequest {
  token: string;
}
export interface PayResponse {
  authorizationUrl: string;
  reference: string;
  mock: boolean;
}
export interface VerifyPaymentResponse {
  /** The order ref, or the invoice number when `kind` is 'invoice'. */
  ref: string;
  kind?: 'order' | 'invoice';
  paid: boolean;
  mock?: boolean;
  gatewayStatus?: string;
}

/* Invoices */
export interface InvoiceLineView {
  ref: string;
  title: string;
  placedBy: string;
  createdAt: ISODateString;
  total: number;
}
export interface InvoiceView {
  number: string;
  organization: { id: string; name: string };
  period: { year: number; month: number; label: string };
  status: InvoiceStatus;
  overdue: boolean;
  total: number;
  currency: 'NGN';
  billingEmail: string;
  issuedAt: ISODateString;
  dueAt: ISODateString;
  paidAt?: ISODateString;
  voidedAt?: ISODateString;
  voidReason?: string;
  payment: { method?: InvoicePaymentMethod; provider?: string; note?: string };
  lines: InvoiceLineView[];
}
export interface InvoiceResponse {
  invoice: InvoiceView;
  /** How to pay by bank transfer instead, when configured. */
  bankDetails?: string;
}
/** Orders placed so far this month that will appear on the next invoice. */
export interface UpcomingInvoice {
  period: { year: number; month: number; label: string };
  orders: number;
  total: number;
}
export interface ClientInvoicesResponse {
  invoices: InvoiceView[];
  upcoming: UpcomingInvoice;
  outstanding: number;
}
export interface OpsInvoicesResponse {
  invoices: InvoiceView[];
  totals: { outstanding: number; overdue: number; paidThisMonth: number };
}
export interface InvoicePayRequest {
  token?: string;
}
export interface MarkInvoicePaidRequest {
  method: Exclude<InvoicePaymentMethod, 'online'>;
  note?: string;
}
export interface VoidInvoiceRequest {
  reason: string;
}
export interface RunBillingResponse {
  period: { year: number; month: number; label: string };
  created: number;
}
export interface OrderResponse {
  order: OrderView;
}

/* Consultations */
export interface ConsultationRequest {
  name: string;
  institution: string;
  email: string;
  phone?: string;
  documentType?: string;
  message?: string;
}

/* Enterprise */
export interface StatsResponse {
  totals: {
    total: number;
    thisMonth: number;
    inProgress: number;
    delivered: number;
    pagesThisMonth: number;
    invoicedThisMonth: number;
  };
  series: { month: string; orders: number; pages: number }[];
  byStatus: { status: OrderStatus; label: string; count: number }[];
  recent: OrderView[];
}

export interface OrdersPageResponse {
  items: OrderView[];
  total: number;
  page: number;
  pages: number;
}

export interface SettingsResponse {
  user: PublicUser;
  organization: OrganizationView;
}

export interface UpdateOrganizationRequest {
  name?: string;
  billingEmail?: string;
  defaultDelivery?: Partial<DefaultDelivery>;
  preferences?: Partial<OrganizationPreferences>;
}
export interface UpdateOrganizationResponse {
  organization: OrganizationView;
}

export interface TeamMember extends PublicUser {
  active: boolean;
}
export interface TeamResponse {
  members: TeamMember[];
}
export interface AddTeamMemberRequest {
  name: string;
  email: string;
  role: Extract<Role, 'admin' | 'member'>;
  password: string;
}
export interface AddTeamMemberResponse {
  member: TeamMember;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/* Operations */
export interface QueueResponse {
  items: OrderView[];
}
export interface StatusChangeRequest {
  status: OrderStatus;
  note?: string;
  handoverCode?: string;
  /** Required when moving to out_for_delivery unless a rider is already assigned. */
  rider?: { name: string; phone: string };
  eta?: ISODateString;
}
export interface AccessLogEntryView {
  action: string;
  detail: string;
  at: ISODateString;
  by: string;
  ref?: string;
}
export interface AccessLogResponse {
  entries: AccessLogEntryView[];
}

export interface DispatchRequest {
  riderName: string;
  riderPhone: string;
  eta?: ISODateString | null;
}
export interface DeliveryUpdateRequest {
  message: string;
  /** Email the customer as well as showing the update on their tracking page. */
  notify: boolean;
}

export type EmailStatus = 'sent' | 'failed' | 'skipped';
export interface EmailView {
  id: string;
  to: string;
  subject: string;
  template: string;
  orderRef?: string;
  status: EmailStatus;
  error?: string;
  provider: string;
  at: ISODateString;
}
export interface EmailsResponse {
  items: EmailView[];
  total: number;
  page: number;
  pages: number;
  provider: string;
}
export interface EmailTemplateInfo {
  id: string;
  name: string;
  description: string;
}
export interface EmailTemplatesResponse {
  templates: EmailTemplateInfo[];
}

export interface OpsOrderResponse {
  order: OrderView;
  log: AccessLogEntryView[];
  emails: EmailView[];
}

export interface OpsOverviewResponse {
  pipeline: { status: OrderStatus; label: string; count: number }[];
  today: { received: number; delivered: number; revenue: number; pages: number };
  month: { orders: number; revenue: number; pages: number; expressRevenue: number; invoiced: number };
  turnaroundHours: number | null;
  awaitingPayment: number;
  alerts: { kind: 'overdue' | 'expiring' | 'unassigned'; ref: string; title: string; detail: string }[];
  series: { day: string; orders: number; revenue: number }[];
  byZone: { zone: string; label: string; orders: number }[];
  activity: AccessLogEntryView[];
}

export interface ClientView {
  id: string;
  name: string;
  billingEmail: string;
  members: number;
  orders: number;
  inProgress: number;
  spend: number;
  spendThisMonth: number;
  lastOrderAt?: ISODateString;
}
export interface ClientsResponse {
  clients: ClientView[];
  express: { customers: number; orders: number; revenue: number };
}
