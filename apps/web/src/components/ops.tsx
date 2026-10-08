// Print-room building blocks shared by the queue, deliveries board and order page.
import { useState, type FormEvent } from 'react';
import type { DeliveryUpdateView, OrderResponse, OrderView } from '@tesseract/shared';
import { api, errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';

/* ─────────── Riders ─────────── */

interface Rider {
  name: string;
  phone: string;
}

const RIDERS_KEY = 'tp:riders';

/** Riders used recently on this device, so dispatchers can pick instead of retyping. */
function recentRiders(): Rider[] {
  try {
    const list = JSON.parse(localStorage.getItem(RIDERS_KEY) || '[]') as Rider[];
    return Array.isArray(list) ? list.filter((r) => r && r.name && r.phone) : [];
  } catch {
    return [];
  }
}

function rememberRider(rider: Rider): void {
  try {
    const rest = recentRiders().filter((r) => r.name.toLowerCase() !== rider.name.toLowerCase());
    localStorage.setItem(RIDERS_KEY, JSON.stringify([rider, ...rest].slice(0, 12)));
  } catch {
    /* storage unavailable */
  }
}

/** Turns an "HH:MM" from a time input into today's (or tomorrow's) date in Abuja time. */
export function etaFromTime(hhmm: string): string | undefined {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return undefined;
  const [h, m] = hhmm.split(':').map(Number);
  const now = new Date();
  const lagos = new Date(now.getTime() + 60 * 60 * 1000);
  let at = Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate(), h, m) - 60 * 60 * 1000;
  if (at < now.getTime() - 30 * 60 * 1000) at += 24 * 60 * 60 * 1000;
  return new Date(at).toISOString();
}

function timeValue(iso?: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Lagos' }).format(new Date(iso));
}

export function formatTime(iso?: string): string {
  return iso ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(new Date(iso)) : '';
}

/**
 * Assigns a rider. With `sendOut`, also moves a sealed order to "Out for delivery",
 * which emails the customer the rider's details.
 */
export function RiderForm({ order, sendOut, onDone, onCancel }: { order: OrderView; sendOut?: boolean; onDone: (o: OrderView) => void; onCancel?: () => void }) {
  const [name, setName] = useState(order.dispatch?.riderName ?? '');
  const [phone, setPhone] = useState(order.dispatch?.riderPhone ?? '');
  const [eta, setEta] = useState(timeValue(order.dispatch?.eta));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const riders = recentRiders();
  const id = order.ref;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const etaIso = etaFromTime(eta) ?? null;
      const res = sendOut
        ? await api<OrderResponse>(`/ops/orders/${order.ref}/status`, {
            method: 'POST',
            auth: true,
            body: { status: 'out_for_delivery', rider: { name, phone }, ...(etaIso ? { eta: etaIso } : {}) }
          })
        : await api<OrderResponse>(`/ops/orders/${order.ref}/dispatch`, { method: 'POST', auth: true, body: { riderName: name, riderPhone: phone, eta: etaIso } });
      rememberRider({ name: name.trim(), phone: phone.trim() });
      onDone(res.order);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="ops-form" onSubmit={submit}>
      {riders.length > 0 && (
        <div className="chips" role="group" aria-label="Recent riders">
          {riders.slice(0, 6).map((r) => (
            <button
              key={r.name}
              type="button"
              className={`chip${r.name === name ? ' is-on' : ''}`}
              onClick={() => {
                setName(r.name);
                setPhone(r.phone);
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
      <div className="ops-form__row">
        <div className="c-field">
          <label htmlFor={`rider-${id}`}>Rider</label>
          <input id={`rider-${id}`} className="c-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="off" required />
        </div>
        <div className="c-field">
          <label htmlFor={`phone-${id}`}>Phone</label>
          <input id={`phone-${id}`} className="c-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 000 0000" required />
        </div>
        <div className="c-field ops-form__eta">
          <label htmlFor={`eta-${id}`}>Arrives by</label>
          <input id={`eta-${id}`} className="c-input" type="time" value={eta} onChange={(e) => setEta(e.target.value)} />
        </div>
      </div>
      {error && <div className="c-alert" role="alert">{error}</div>}
      <div className="ops-form__actions">
        {onCancel && (
          <button type="button" className="c-btn c-btn--quiet c-btn--small" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="c-btn c-btn--primary c-btn--small" disabled={busy || !name.trim() || !phone.trim()}>
          {busy && <span className="spinner" aria-hidden="true" />}
          {sendOut ? 'Send out and notify customer' : order.dispatch ? 'Update rider' : 'Assign rider'}
        </button>
      </div>
    </form>
  );
}

/* ─────────── Delivery updates ─────────── */

const QUICK_UPDATES = [
  'The rider has collected your sealed envelope and is on the way.',
  'The rider is about 15 minutes away.',
  'The rider has arrived. Please have your handover code ready.',
  'We’re running a little late because of traffic. Thank you for your patience.',
  'The rider couldn’t reach the recipient. Please call the rider or reply to this email.'
];

export function UpdateComposer({ order, onDone }: { order: OrderView; onDone: (o: OrderView) => void }) {
  const [message, setMessage] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = `update-${order.ref}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<OrderResponse>(`/ops/orders/${order.ref}/updates`, { method: 'POST', auth: true, body: { message, notify } });
      setMessage('');
      onDone(res.order);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="ops-form" onSubmit={submit}>
      <div className="chips" role="group" aria-label="Quick updates">
        {QUICK_UPDATES.map((q) => (
          <button key={q} type="button" className="chip" onClick={() => setMessage(q)}>
            {q.split(/[.,]/)[0]}
          </button>
        ))}
      </div>
      <div className="c-field">
        <label htmlFor={id}>Update for the customer</label>
        <textarea id={id} className="c-input" rows={3} maxLength={600} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Shown on their tracking page" />
      </div>
      {error && <div className="c-alert" role="alert">{error}</div>}
      <div className="ops-form__actions">
        <label className="check">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          <span>Also email {order.customer?.name?.split(' ')[0] ?? 'the customer'}</span>
        </label>
        <button type="submit" className="c-btn c-btn--primary c-btn--small" disabled={busy || message.trim().length < 3}>
          {busy && <span className="spinner" aria-hidden="true" />}
          Post update
        </button>
      </div>
    </form>
  );
}

export function UpdatesFeed({ updates, empty = 'No updates posted yet.' }: { updates: DeliveryUpdateView[]; empty?: string }) {
  if (!updates.length) return <p className="muted-note">{empty}</p>;
  return (
    <ol className="feed">
      {[...updates].reverse().map((u) => (
        <li key={u.id}>
          <i aria-hidden="true" />
          <div>
            <p>{u.message}</p>
            <small>
              {formatDate(u.at)}
              {u.by ? ` · ${u.by}` : ''}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ─────────── Handover ─────────── */

export function DeliverForm({ order, onDone }: { order: OrderView; onDone: (o: OrderView) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<OrderResponse>(`/ops/orders/${order.ref}/status`, { method: 'POST', auth: true, body: { status: 'delivered', handoverCode: code } });
      onDone(res.order);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="ops-form" onSubmit={submit}>
      <div className="ops-form__row ops-form__row--code">
        <div className="c-field">
          <label htmlFor={`code-${order.ref}`}>Recipient’s handover code</label>
          <input
            id={`code-${order.ref}`}
            className="c-input code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="••••••"
          />
        </div>
        <button type="submit" className="c-btn c-btn--primary" disabled={code.length !== 6 || busy}>
          {busy && <span className="spinner" aria-hidden="true" />}
          Confirm delivery and erase file
        </button>
      </div>
      {error && <div className="c-alert" role="alert">{error}</div>}
    </form>
  );
}

/** One-line description of the print job. */
export function jobSummary(o: OrderView): string {
  return `${o.options.pages} pp × ${o.options.copies} · ${o.options.colour === 'colour' ? 'Colour' : 'B&W'} · ${o.options.sides === 'double' ? 'Duplex' : 'Simplex'} · ${o.options.paperSize}`;
}

/** "3h 20m ago"-style age, for spotting slow jobs at a glance. */
export function age(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
