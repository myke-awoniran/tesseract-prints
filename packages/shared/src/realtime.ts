// Real-time events pushed over Socket.IO. The server emits these; the web app listens.
import type { OrderView } from './api-types.js';

/** Socket.IO endpoint, mounted under the API prefix so it shares the API's origin and proxy. */
export const REALTIME_PATH = '/api/socket.io';

export type NoticeTone = 'info' | 'success' | 'warning';

/** A short, human message worth surfacing as a toast, e.g. "New paid order TP-7K3Q9XA". */
export interface LiveNotice {
  id: string;
  tone: NoticeTone;
  title: string;
  body: string;
  /** Order reference or invoice number the notice is about. */
  ref?: string;
  /** Where clicking the notice should go, as an in-app path. */
  link?: string;
  at: string;
}

export interface InvoiceEvent {
  number: string;
  status: string;
}

export interface ServerToClientEvents {
  /** An order changed. Each audience receives the view it is entitled to. */
  order: (payload: { order: OrderView }) => void;
  invoice: (payload: InvoiceEvent) => void;
  notify: (notice: LiveNotice) => void;
}

export interface TrackJoinResult {
  ok: boolean;
  error?: string;
}

export interface ClientToServerEvents {
  /** Follow one order with its private tracking token, as the tracking page does. */
  'track:join': (input: { ref: string; token: string }, ack: (result: TrackJoinResult) => void) => void;
  'track:leave': (input: { ref: string }) => void;
}
