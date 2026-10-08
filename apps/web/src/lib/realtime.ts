// One Socket.IO connection per tab, shared by every page. Signed-in users are identified by their
// console token; the public tracking page follows a single order with its tracking token.
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { REALTIME_PATH, type ClientToServerEvents, type ServerToClientEvents, type OrderView } from '@tesseract/shared';
import { getToken } from './api';

type LiveSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type ServerEvent = keyof ServerToClientEvents;

let socket: LiveSocket | null = null;
let connectedWith: string | null = null;

export function getSocket(): LiveSocket {
  if (!socket) {
    socket = io({
      path: REALTIME_PATH,
      auth: (cb) => {
        connectedWith = getToken();
        cb({ token: connectedWith ?? '' });
      },
      reconnectionDelayMax: 10_000
    });
  }
  return socket;
}

/** Reconnects when the console token changes (sign-in or sign-out), so the server puts us in the right rooms. */
export function syncRealtimeIdentity(): void {
  const s = getSocket();
  if (connectedWith === getToken() && (s.connected || s.active)) return;
  s.disconnect();
  s.connect();
}

/** Calls `handler` for every `event` while mounted. The latest handler is always used. */
export function useRealtimeEvent<E extends ServerEvent>(event: E, handler: ServerToClientEvents[E]): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket();
    const listener = ((...args: Parameters<ServerToClientEvents[E]>) => (ref.current as (...a: unknown[]) => void)(...args)) as never;
    s.on(event, listener);
    return () => {
      s.off(event, listener);
    };
  }, [event]);
}

export type ConnectionState = 'connected' | 'connecting' | 'offline';

export function useConnectionState(): ConnectionState {
  const s = getSocket();
  const [state, setState] = useState<ConnectionState>(s.connected ? 'connected' : 'connecting');
  useEffect(() => {
    const up = () => setState('connected');
    const down = () => setState(s.active ? 'connecting' : 'offline');
    const failed = () => setState('offline');
    const retrying = () => setState('connecting');
    s.on('connect', up);
    s.on('disconnect', down);
    s.io.on('reconnect_attempt', retrying);
    s.io.on('reconnect_failed', failed);
    s.on('connect_error', down);
    setState(s.connected ? 'connected' : 'connecting');
    return () => {
      s.off('connect', up);
      s.off('disconnect', down);
      s.off('connect_error', down);
      s.io.off('reconnect_attempt', retrying);
      s.io.off('reconnect_failed', failed);
    };
  }, [s]);
  return state;
}

interface LiveReloadOptions {
  /** Reload only for orders this returns true for. Defaults to every order. */
  order?: (order: OrderView) => boolean;
  /** Also reload when an invoice changes. */
  invoices?: boolean;
  /** Ignore order events entirely (e.g. a page that only shows invoices). */
  orders?: boolean;
  /** Wait this long after the last event before reloading, e.g. for emails sent just after a change. */
  delay?: number;
}

/**
 * A number that goes up when data a page shows has changed on the server, or after a reconnect
 * (when events may have been missed). Add it to a loader's dependencies to refetch.
 * Bursts are coalesced so ten events in a second cause one reload.
 */
export function useLiveReload({ order, invoices = false, orders = true, delay = 350 }: LiveReloadOptions = {}): number {
  const [tick, setTick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filter = useRef(order);
  filter.current = order;

  useEffect(() => {
    const s = getSocket();
    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setTick((t) => t + 1), delay);
    };
    const onOrder = ({ order: o }: { order: OrderView }) => {
      if (orders && (!filter.current || filter.current(o))) bump();
    };
    let seenFirstConnect = s.connected;
    const onConnect = () => {
      if (seenFirstConnect) bump();
      seenFirstConnect = true;
    };
    s.on('order', onOrder);
    if (invoices) s.on('invoice', bump);
    s.on('connect', onConnect);
    return () => {
      s.off('order', onOrder);
      s.off('invoice', bump);
      s.off('connect', onConnect);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [invoices, orders, delay]);

  return tick;
}

/**
 * Follows one order with its private tracking token. `onOrder` receives each new state;
 * the subscription is renewed after every reconnect. Returns whether the server accepted it.
 */
export function useTrackedOrder(ref: string, token: string | null, onOrder: (order: OrderView) => void): boolean {
  const [following, setFollowing] = useState(false);
  const handler = useRef(onOrder);
  handler.current = onOrder;

  useEffect(() => {
    if (!ref || !token) return;
    const s = getSocket();
    const join = () => s.emit('track:join', { ref, token }, (res) => setFollowing(Boolean(res?.ok)));
    const onEvent = ({ order }: { order: OrderView }) => {
      if (order.ref === ref) handler.current(order);
    };
    const onDown = () => setFollowing(false);
    s.on('order', onEvent);
    s.on('connect', join);
    s.on('disconnect', onDown);
    if (s.connected) join();
    return () => {
      s.off('order', onEvent);
      s.off('connect', join);
      s.off('disconnect', onDown);
      if (s.connected) s.emit('track:leave', { ref });
    };
  }, [ref, token]);

  return following;
}
