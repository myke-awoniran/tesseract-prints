import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ZONES,
  FINISHING,
  PAPER_SIZES,
  type Colour,
  type FinishingId,
  type OrderResponse,
  type PaperSize,
  type SettingsResponse,
  type Sides
} from '@tesseract/shared';
import { api, upload, ApiError, errorMessage } from '../../lib/api';
import { useRouter } from '../../lib/router';
import { FileDrop, checkFile } from '../../components/FileDrop';
import { PageHead } from './ConsoleLayout';

interface NewOrderForm {
  title: string;
  pages: string;
  copies: string;
  colour: Colour;
  sides: Sides;
  paperSize: PaperSize;
  finishing: FinishingId;
  recipientName: string;
  phone: string;
  area: string;
  address: string;
  instructions: string;
}

type TextField = 'title' | 'pages' | 'copies' | 'recipientName' | 'phone' | 'area' | 'address' | 'instructions';

const BLANK: NewOrderForm = {
  title: '',
  pages: '',
  copies: '1',
  colour: 'mono',
  sides: 'double',
  paperSize: 'A4',
  finishing: 'none',
  recipientName: '',
  phone: '',
  area: '',
  address: '',
  instructions: ''
};

interface SegProps<T extends string> {
  name: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
}

function Seg<T extends string>({ name, value, options, onChange }: SegProps<T>) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <label key={o.id}>
          <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export default function NewOrder() {
  const { navigate } = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<NewOrderForm>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    api<SettingsResponse>('/enterprise/settings', { auth: true })
      .then(({ organization }) => {
        const d = organization.defaultDelivery;
        const p = organization.preferences;
        setForm((f) => ({
          ...f,
          recipientName: d.recipientName || '',
          phone: d.phone || '',
          area: d.area || '',
          address: d.address || '',
          colour: p.defaultColour || f.colour,
          finishing: p.defaultFinishing || f.finishing
        }));
      })
      .catch(() => {});
  }, []);

  const setField = <K extends keyof NewOrderForm>(k: K, v: NewOrderForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const bind = (k: TextField) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setField(k, e.target.value);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const fileError = checkFile(file);
    if (fileError) errs.file = fileError;
    if (file && file.type !== 'application/pdf' && !(Number(form.pages) >= 1)) errs.pages = 'Enter the number of pages.';
    if (!(Number(form.copies) >= 1)) errs.copies = 'Enter at least one copy.';
    if (!form.area) errs.area = 'Choose a delivery area.';
    if (form.address.trim().length < 6) errs.address = 'Enter the delivery address.';
    if (!form.phone.trim()) errs.phone = 'Enter a contact number for the recipient.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setError('');
    setProgress(0);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('file', file);
      const res = await upload<OrderResponse>('/enterprise/orders', fd, { auth: true, onProgress: setProgress });
      navigate(`/console/orders/${res.order.ref}`);
    } catch (err) {
      setBusy(false);
      setError(errorMessage(err));
      const fieldErrors = err instanceof ApiError ? err.fieldErrors : null;
      if (fieldErrors) setErrors(fieldErrors);
    }
  }

  return (
    <>
      <PageHead title="New order" subtitle="Orders are invoiced to your organisation and go straight to the print room." />
      <form className="c-form" onSubmit={submit} style={{ maxWidth: 860 }} noValidate>
        <section className="panel">
          <div className="panel__head">
            <h2>Document</h2>
            <span>Encrypted on arrival · erased within 24 hours</span>
          </div>
          <div className="c-form">
            <FileDrop variant="console" id="console-file" file={file} error={errors.file} onChange={setFile} />
            <div className="c-form-grid">
              <div className="c-field">
                <label htmlFor="title">Reference or title (optional)</label>
                <input id="title" className="c-input" maxLength={140} value={form.title} onChange={bind('title')} placeholder="e.g. FCTA tender, Lot 3" />
              </div>
              <div className="c-field">
                <label htmlFor="pages">Pages</label>
                <input id="pages" className="c-input" type="number" min="1" value={form.pages} onChange={bind('pages')} aria-invalid={Boolean(errors.pages)} />
                {errors.pages ? <span className="c-error">{errors.pages}</span> : <span className="hint">Counted automatically for PDFs.</span>}
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Printing</h2>
          </div>
          <div className="c-form">
            <div className="c-field">
              <label>Colour</label>
              <Seg name="colour" value={form.colour} onChange={(v) => setField('colour', v)} options={[{ id: 'mono', label: 'Black and white' }, { id: 'colour', label: 'Colour' }] as const} />
            </div>
            <div className="c-field">
              <label>Sides</label>
              <Seg name="sides" value={form.sides} onChange={(v) => setField('sides', v)} options={[{ id: 'double', label: 'Double-sided' }, { id: 'single', label: 'Single-sided' }] as const} />
            </div>
            <div className="c-field">
              <label>Finishing</label>
              <Seg name="finishing" value={form.finishing} onChange={(v) => setField('finishing', v)} options={FINISHING} />
            </div>
            <div className="c-form-grid">
              <div className="c-field">
                <label htmlFor="paper">Paper size</label>
                <select id="paper" className="c-input" value={form.paperSize} onChange={(e) => setField('paperSize', e.target.value as PaperSize)}>
                  {PAPER_SIZES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="c-field">
                <label htmlFor="copies">Copies</label>
                <input id="copies" className="c-input" type="number" min="1" max="500" value={form.copies} onChange={bind('copies')} aria-invalid={Boolean(errors.copies)} />
                {errors.copies && <span className="c-error">{errors.copies}</span>}
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2>Delivery</h2>
            <span>Prefilled from your organisation’s defaults</span>
          </div>
          <div className="c-form-grid">
            <div className="c-field">
              <label htmlFor="recipient">Recipient</label>
              <input id="recipient" className="c-input" value={form.recipientName} onChange={bind('recipientName')} />
            </div>
            <div className="c-field">
              <label htmlFor="phone">Recipient phone</label>
              <input id="phone" className="c-input" type="tel" value={form.phone} onChange={bind('phone')} aria-invalid={Boolean(errors.phone)} />
              {errors.phone && <span className="c-error">{errors.phone}</span>}
            </div>
            <div className="c-field">
              <label htmlFor="area">Area</label>
              <select id="area" className="c-input" value={form.area} onChange={bind('area')} aria-invalid={Boolean(errors.area)}>
                <option value="">Choose an area</option>
                {ZONES.map((z) => (
                  <optgroup key={z.id} label={z.name}>
                    {z.areas.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {errors.area && <span className="c-error">{errors.area}</span>}
            </div>
            <div className="c-field">
              <label htmlFor="address">Address</label>
              <input id="address" className="c-input" value={form.address} onChange={bind('address')} aria-invalid={Boolean(errors.address)} />
              {errors.address && <span className="c-error">{errors.address}</span>}
            </div>
            <div className="c-field span-2">
              <label htmlFor="instructions">Instructions for the courier (optional)</label>
              <textarea id="instructions" className="c-input" maxLength={500} value={form.instructions} onChange={bind('instructions')} />
            </div>
          </div>
        </section>

        {busy && (
          <div>
            <p style={{ color: 'var(--c-muted)', fontSize: 14, marginBottom: 8 }}>Encrypting and uploading… {progress}%</p>
            <div className="c-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {error && <div className="c-alert" role="alert">{error}</div>}
        <div className="form-actions">
          <button type="submit" className="c-btn c-btn--primary" disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy ? 'Placing order' : 'Place order'}
          </button>
          <span style={{ color: 'var(--c-muted)', fontSize: 14 }}>Added to this month’s invoice.</span>
        </div>
      </form>
    </>
  );
}
