// Console-wide live UI: toasts for server notices, desktop alerts when the tab is in the background,
// and a small connection indicator.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveNotice } from '@tesseract/shared';
import { useConnectionState, useRealtimeEvent } from '../lib/realtime';
import { useRouter } from '../lib/router';
import { Icon } from './Icons';

const TOAST_MS = 8000;
const MAX_TOASTS = 4;

function canNotify(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export function LiveToasts() {
  const { navigate } = useRouter();
  const [toasts, setToasts] = useState<LiveNotice[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const schedule = useCallback((id: string) => timers.current.set(id, setTimeout(() => dismiss(id), TOAST_MS)), [dismiss]);

  useRealtimeEvent('notify', (notice) => {
    setToasts((t) => [notice, ...t].slice(0, MAX_TOASTS));
    schedule(notice.id);
    if (document.visibilityState === 'hidden' && canNotify()) {
      try {
        const n = new Notification(notice.title, { body: notice.body, tag: notice.id, icon: '/favicon.svg' });
        n.onclick = () => {
          window.focus();
          if (notice.link) navigate(notice.link);
          n.close();
        };
      } catch {
        /* some browsers only allow notifications from a service worker */
      }
    }
  });

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <div className="toasts" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.tone}`}
          role="status"
          onMouseEnter={() => {
            const timer = timers.current.get(t.id);
            if (timer) clearTimeout(timer);
          }}
          onMouseLeave={() => schedule(t.id)}
        >
          <span className="toast__icon" aria-hidden="true">
            {t.tone === 'success' ? <Icon.Check width={16} height={16} /> : t.tone === 'warning' ? <Icon.Pause width={16} height={16} /> : <Icon.Truck width={16} height={16} />}
          </span>
          <button
            type="button"
            className="toast__body"
            onClick={() => {
              if (t.link) navigate(t.link);
              dismiss(t.id);
            }}
          >
            <strong>{t.title}</strong>
            <span>{t.body}</span>
          </button>
          <button type="button" className="toast__close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            <Icon.Close width={14} height={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** "Live" dot for the console sidebar. Click it to allow desktop alerts. */
export function LiveStatus() {
  const state = useConnectionState();
  const [permission, setPermission] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const label = state === 'connected' ? 'Live' : state === 'connecting' ? 'Reconnecting' : 'Offline';
  const askable = permission === 'default';

  return (
    <button
      type="button"
      className={`live live--${state}`}
      onClick={async () => {
        if (!askable) return;
        try {
          setPermission(await Notification.requestPermission());
        } catch {
          /* ignored */
        }
      }}
      title={
        state === 'connected'
          ? askable
            ? 'Updates arrive instantly. Click to also get desktop alerts when this tab is in the background.'
            : 'Updates arrive instantly.'
          : 'Trying to reconnect. Pages refresh themselves once the connection is back.'
      }
    >
      <span className="live__dot" aria-hidden="true" />
      {label}
      {state === 'connected' && askable && <span className="live__hint">Enable alerts</span>}
    </button>
  );
}
