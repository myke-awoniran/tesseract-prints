import type { ApiErrorBody } from '@tesseract/shared';

const TOKEN_KEY = 'tesseract.console.token';
export const SIGNED_OUT_EVENT = 'tesseract:signed-out';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the session lasts until reload */
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: ApiErrorBody['details'];

  constructor(message: string, status: number, details?: ApiErrorBody['details']) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  /** Field-level messages, when the server returned them. */
  get fieldErrors(): Record<string, string> | null {
    return this.details && !Array.isArray(this.details) ? this.details : null;
  }
}

function toError(status: number, data?: Partial<ApiErrorBody>): ApiError {
  const message =
    status === 0 ? 'We could not reach Tesseract Prints. Check your connection and try again.' : data?.error || `Request failed (${status}).`;
  return new ApiError(message, status, data?.details);
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Try again.';
}

export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

export async function api<T>(path: string, { method = 'GET', body, auth = false, signal }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw toError(0);
  }
  const data: unknown = await res.json().catch(() => ({}));
  if (res.status === 401 && auth) {
    setToken(null);
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  }
  if (!res.ok) throw toError(res.status, data as Partial<ApiErrorBody>);
  return data as T;
}

/** Multipart upload with progress reporting (fetch cannot report upload progress). */
export function upload<T>(path: string, formData: FormData, { auth = false, onProgress }: { auth?: boolean; onProgress?: (percent: number) => void } = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    const token = auth ? getToken() : null;
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: unknown = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON response */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else reject(toError(xhr.status, data as Partial<ApiErrorBody>));
    };
    xhr.onerror = () => reject(toError(0));
    xhr.send(formData);
  });
}

export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Partial<ApiErrorBody>;
    throw toError(res.status, data);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Express customers have no account; their order access token is kept on this device.
const EXPRESS_KEY = 'tesseract.express.orders';

type ExpressStore = Record<string, { token: string; savedAt: number }>;

function readExpressStore(): ExpressStore {
  try {
    return JSON.parse(localStorage.getItem(EXPRESS_KEY) || '{}') as ExpressStore;
  } catch {
    return {};
  }
}

export function rememberExpressOrder(ref: string, token: string): void {
  try {
    const all = readExpressStore();
    all[ref] = { token, savedAt: Date.now() };
    localStorage.setItem(EXPRESS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function recallExpressToken(ref: string): string | null {
  return readExpressStore()[ref]?.token ?? null;
}

/** The express order most recently placed on this device, if it was placed in the last `withinMs`. */
export function recallLatestExpressOrder(withinMs: number): { ref: string; token: string } | null {
  let latest: { ref: string; token: string; savedAt: number } | null = null;
  for (const [ref, entry] of Object.entries(readExpressStore())) {
    if (!latest || entry.savedAt > latest.savedAt) latest = { ref, ...entry };
  }
  return latest && Date.now() - latest.savedAt <= withinMs ? { ref: latest.ref, token: latest.token } : null;
}

// Whoever opens an invoice from its email link keeps the link on this device, to find it again after paying.
const INVOICE_KEY = 'tesseract.invoices';

export function rememberInvoiceLink(number: string, token: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(INVOICE_KEY) || '{}') as Record<string, string>;
    all[number] = token;
    localStorage.setItem(INVOICE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function recallInvoiceToken(number: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(INVOICE_KEY) || '{}') as Record<string, string>)[number] ?? null;
  } catch {
    return null;
  }
}
