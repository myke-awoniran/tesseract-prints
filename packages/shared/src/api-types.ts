// Request and response shapes for the HTTP API. The server returns these; the web app consumes them.
import type {
  Colour,
  FinishingId,
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

export interface OrderView {
  ref: string;
  channel: OrderChannel;
  title: string;
  status: OrderStatus;
  statusLabel: string;
  timeline: TimelineEntryView[];
  options: PrintOptions;
  quote: Quote;
  payment: { status: PaymentStatus; paidAt?: ISODateString };
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
  ref: string;
  paid: boolean;
  mock?: boolean;
  gatewayStatus?: string;
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
}
export interface AccessLogResponse {
  entries: { action: string; detail: string; at: ISODateString; by: string }[];
}
