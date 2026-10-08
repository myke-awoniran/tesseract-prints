import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  ZONES,
  FINISHING,
  PAPER_SIZES,
  PAPER_TYPES,
  paperTypeLabel,
  type PaperType,
  computeQuote,
  PRICING,
  zoneForArea,
  formatNaira,
  finishingLabel,
  FILE_TTL_SECONDS,
  type Colour,
  type CreateExpressOrderResponse,
  type FinishingId,
  type PaperSize,
  type PayResponse,
  type Quote,
  type Sides
} from '@tesseract/shared';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { FileDrop, checkFile } from '../components/FileDrop';
import { Icon } from '../components/Icons';
import { api, upload, rememberExpressOrder, ApiError, errorMessage } from '../lib/api';
import { useRouter } from '../lib/router';

const STEPS = ['Document', 'Printing', 'Delivery', 'Review and pay'];

interface ExpressForm {
  pages: string;
  copies: string;
  colour: Colour;
  sides: Sides;
  paperSize: PaperSize;
  paperType: PaperType;
  finishing: FinishingId;
  name: string;
  email: string;
  phone: string;
  recipientName: string;
  recipientPhone: string;
  area: string;
  address: string;
  instructions: string;
}

type Errors = Record<string, string>;

interface CreatedOrder {
  ref: string;
  token: string;
  quote: Quote;
  pages: number;
}

const INITIAL: ExpressForm = {
  pages: '',
  copies: '1',
  colour: 'mono',
  sides: 'double',
  paperSize: 'A4',
  paperType: 'standard',
  finishing: 'none',
  name: '',
  email: '',
  phone: '',
  recipientName: '',
  recipientPhone: '',
  area: '',
  address: '',
  instructions: ''
};

function validateStep(step: number, file: File | null, f: ExpressForm): Errors {
  const e: Errors = {};
  if (step === 0) {
    const fileError = checkFile(file);
    if (fileError) e.file = fileError;
    const isPdf = file?.type === 'application/pdf';
    const pages = Number(f.pages);
    if (!isPdf && !(pages >= 1)) e.pages = 'Enter how many pages the document has.';
    if (f.pages && !(pages >= 1 && pages <= 5000)) e.pages = 'Pages must be between 1 and 5,000.';
  }
  if (step === 1) {
    const copies = Number(f.copies);
    if (!(copies >= 1 && copies <= 500)) e.copies = 'Copies must be between 1 and 500.';
  }
  if (step === 2) {
    if (f.name.trim().length < 2) e.name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email address.';
    if (!/^\+?[0-9 ()-]{7,20}$/.test(f.phone.trim())) e.phone = 'Enter a valid phone number.';
    if (f.recipientName.trim().length < 2) e.recipientName = 'Enter the name of the person receiving the documents.';
    if (!/^\+?[0-9 ()-]{7,20}$/.test(f.recipientPhone.trim())) e.recipientPhone = 'Enter the recipient’s phone number, so the rider can reach them.';
    if (!zoneForArea(f.area)) e.area = 'Choose your area.';
    if (f.address.trim().length < 6) e.address = 'Enter the full delivery address.';
    if (f.instructions.trim().length < 3) e.instructions = 'Add directions for the rider: a landmark, gate, floor or office.';
  }
  return e;
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

interface ChoiceProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  label: string;
  note?: string;
}

function Choice({ name, value, checked, onChange, label, note }: ChoiceProps) {
  return (
    <label className="choice">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      <span>
        {label}
        {note && <small>{note}</small>}
      </span>
    </label>
  );
}

export default function Express() {
  const { navigate } = useRouter();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [detectedPages, setDetectedPages] = useState<number | null>(null);
  const [form, setForm] = useState<ExpressForm>(INITIAL);
  const [selfRecipient, setSelfRecipient] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [created, setCreated] = useState<CreatedOrder | null>(null);
  const [busy, setBusy] = useState<'' | 'uploading' | 'paying'>('');
  const [progress, setProgress] = useState(0);
  const [serverError, setServerError] = useState('');

  const set =
    (k: keyof ExpressForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  const zone = zoneForArea(form.area);

  // "I'm the recipient" keeps the recipient's name and phone in step with the customer's own.
  useEffect(() => {
    if (selfRecipient) setForm((f) => (f.recipientName === f.name && f.recipientPhone === f.phone ? f : { ...f, recipientName: f.name, recipientPhone: f.phone }));
  }, [selfRecipient, form.name, form.phone]);
  const isPdf = file?.type === 'application/pdf';

  const estimate = useMemo(() => {
    if (created) return created.quote;
    const pages = Number(form.pages);
    if (!(pages >= 1) || !zone) return null;
    return computeQuote({
      colour: form.colour,
      sides: form.sides,
      paperSize: form.paperSize,
      paperType: form.paperType,
      finishing: form.finishing,
      pages,
      copies: Number(form.copies) || 1,
      zone: zone.id
    });
  }, [form, zone, created]);

  function next() {
    const e = validateStep(step, file, form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function back() {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  }

  async function placeOrder() {
    setServerError('');
    let order = created;
    try {
      if (!order) {
        if (!file) {
          setStep(0);
          return;
        }
        setBusy('uploading');
        setProgress(0);
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        fd.append('file', file);
        const res = await upload<CreateExpressOrderResponse>('/express/orders', fd, { onProgress: setProgress });
        order = { ref: res.order.ref, token: res.accessToken, quote: res.order.quote, pages: res.order.options.pages };
        rememberExpressOrder(order.ref, order.token);
        setCreated(order);
      }
      setBusy('paying');
      const pay = await api<PayResponse>(`/express/orders/${order.ref}/pay`, { method: 'POST', body: { token: order.token } });
      navigate(pay.authorizationUrl);
    } catch (err) {
      setBusy('');
      setServerError(errorMessage(err));
      const fieldErrors = err instanceof ApiError ? err.fieldErrors : null;
      if (fieldErrors) {
        setErrors(fieldErrors);
        if (fieldErrors.file || fieldErrors.pages) setStep(0);
        else if (fieldErrors.copies || fieldErrors.paperType || fieldErrors.paperSize) setStep(1);
        else setStep(2);
      }
    }
  }

  const deliveryEta = zone?.eta;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="page-head">
          <div className="container">
            <h1>Express printing</h1>
            <p>Upload, choose how it should be printed, and we deliver it sealed. No account needed.</p>
          </div>
        </div>

        <div className="container checkout">
          <ol className="stepper" aria-label="Order progress">
            {STEPS.map((label, i) => (
              <li key={label} className={i === step ? 'is-current' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
                {i < step && !created ? (
                  <button type="button" onClick={() => setStep(i)}>
                    {label}
                  </button>
                ) : (
                  label
                )}
              </li>
            ))}
          </ol>

          <section className="step-panel" aria-labelledby="step-title">
            {step === 0 && (
              <>
                <h2 id="step-title">Your document</h2>
                <p>Files are encrypted on arrival and erased automatically within {FILE_TTL_SECONDS / 3600} hours.</p>
                <div className="step-body">
                  <FileDrop
                    file={file}
                    error={errors.file}
                    onChange={(f) => {
                      setFile(f);
                      setErrors((e) => ({ ...e, file: f ? checkFile(f) : '' }));
                      if (detectedPages !== null && f?.type !== 'application/pdf') {
                        setDetectedPages(null);
                        setForm((prev) => ({ ...prev, pages: '' }));
                      }
                    }}
                    onPages={(n) => {
                      setDetectedPages(n);
                      if (n !== null) {
                        setForm((prev) => ({ ...prev, pages: String(n) }));
                        setErrors((e) => ({ ...e, pages: '' }));
                      }
                    }}
                  />
                  <Field
                    id="pages"
                    label={isPdf && detectedPages === null ? 'Number of pages (optional)' : 'Number of pages'}
                    hint={
                      detectedPages !== null
                        ? 'Counted from your PDF. Use Preview & edit to remove or rearrange pages.'
                        : isPdf
                          ? 'We count PDF pages automatically. Enter a number to see an estimate now.'
                          : 'Count every page you want printed.'
                    }
                    error={errors.pages}
                  >
                    <input id="pages" className="input" type="number" inputMode="numeric" min="1" max="5000" value={form.pages} onChange={set('pages')} readOnly={detectedPages !== null} aria-invalid={Boolean(errors.pages)} style={{ maxWidth: 220 }} />
                  </Field>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 id="step-title">How it should be printed</h2>
                <p>Choose the finish you would hand to a client.</p>
                <div className="step-body">
                  <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend>Colour</legend>
                    <div className="choice-row" style={{ marginTop: 8 }}>
                      <Choice name="colour" value="mono" checked={form.colour === 'mono'} onChange={set('colour')} label="Black and white" />
                      <Choice name="colour" value="colour" checked={form.colour === 'colour'} onChange={set('colour')} label="Full colour" />
                    </div>
                  </fieldset>
                  <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend>Sides</legend>
                    <div className="choice-row" style={{ marginTop: 8 }}>
                      <Choice name="sides" value="double" checked={form.sides === 'double'} onChange={set('sides')} label="Double-sided" />
                      <Choice name="sides" value="single" checked={form.sides === 'single'} onChange={set('sides')} label="Single-sided" />
                    </div>
                  </fieldset>
                  <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend>Finishing</legend>
                    <div className="choice-row" style={{ marginTop: 8 }}>
                      {FINISHING.map((f) => (
                        <Choice key={f.id} name="finishing" value={f.id} checked={form.finishing === f.id} onChange={set('finishing')} label={f.label} />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend>Paper</legend>
                    <div className="choice-row" style={{ marginTop: 8 }}>
                      {PAPER_TYPES.map((p) => (
                        <Choice key={p.id} name="paperType" value={p.id} checked={form.paperType === p.id} onChange={set('paperType')} label={p.label} note={p.note} />
                      ))}
                    </div>
                  </fieldset>
                  <div className="form-grid">
                    <Field id="paper" label="Paper size">
                      <select id="paper" className="input" value={form.paperSize} onChange={set('paperSize')}>
                        {PAPER_SIZES.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </Field>
                    <Field id="copies" label="Copies" error={errors.copies}>
                      <input id="copies" className="input" type="number" inputMode="numeric" min="1" max="500" value={form.copies} onChange={set('copies')} aria-invalid={Boolean(errors.copies)} />
                    </Field>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 id="step-title">Delivery</h2>
                <p>We release the package only to the recipient, against a code on your tracking page.</p>
                <div className="step-body form-grid">
                  <Field id="name" label="Your full name" error={errors.name}>
                    <input id="name" className="input" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} />
                  </Field>
                  <Field id="phone" label="Phone" error={errors.phone}>
                    <input id="phone" className="input" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} aria-invalid={Boolean(errors.phone)} />
                  </Field>
                  <div className="span-2">
                    <Field id="email" label="Email" hint="For your receipt and tracking link." error={errors.email}>
                      <input id="email" className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} aria-invalid={Boolean(errors.email)} />
                    </Field>
                  </div>
                  <div className="span-2 delivery-split">
                    <h3>Who receives it</h3>
                    <label className="check-line">
                      <input type="checkbox" checked={selfRecipient} onChange={(e) => setSelfRecipient(e.target.checked)} />
                      <span>I’m the recipient</span>
                    </label>
                  </div>
                  <Field id="recipient" label="Recipient’s full name" error={errors.recipientName}>
                    <input id="recipient" className="input" value={form.recipientName} onChange={set('recipientName')} readOnly={selfRecipient} required aria-invalid={Boolean(errors.recipientName)} />
                  </Field>
                  <Field id="recipient-phone" label="Recipient’s phone" hint="The rider calls this number on arrival." error={errors.recipientPhone}>
                    <input id="recipient-phone" className="input" type="tel" value={form.recipientPhone} onChange={set('recipientPhone')} readOnly={selfRecipient} required aria-invalid={Boolean(errors.recipientPhone)} />
                  </Field>
                  <Field id="area" label="Area" hint={deliveryEta ? `Delivery: ${deliveryEta.toLowerCase()}` : undefined} error={errors.area}>
                    <select id="area" className="input" value={form.area} onChange={set('area')} aria-invalid={Boolean(errors.area)}>
                      <option value="">Choose your area</option>
                      {ZONES.map((z) => (
                        <optgroup key={z.id} label={z.name}>
                          {z.areas.map((a) => (
                            <option key={a}>{a}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Field>
                  <div className="span-2">
                    <Field id="address" label="Street address" error={errors.address}>
                      <input id="address" className="input" autoComplete="street-address" value={form.address} onChange={set('address')} aria-invalid={Boolean(errors.address)} />
                    </Field>
                  </div>
                  <div className="span-2">
                    <Field id="instructions" label="Directions for the rider" hint="A landmark, gate colour, floor or office, and a time that suits." error={errors.instructions}>
                      <textarea id="instructions" className="input" rows={3} maxLength={500} value={form.instructions} onChange={set('instructions')} required aria-invalid={Boolean(errors.instructions)} />
                    </Field>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 id="step-title">Review and pay</h2>
                <p>Check the details. You will be taken to our payment partner to complete payment securely.</p>
                <div className="step-body">
                  <dl className="review-list">
                    <div>
                      <dt>Document</dt>
                      <dd>
                        {file?.name}
                        {created ? ` · ${created.pages} pages` : form.pages ? ` · ${form.pages} pages` : ''}
                      </dd>
                      {!created && <button type="button" className="text-link" style={{ background: 'none', borderTop: 0, borderLeft: 0, borderRight: 0 }} onClick={() => setStep(0)}>Change</button>}
                    </div>
                    <div>
                      <dt>Printing</dt>
                      <dd>
                        {form.copies} {Number(form.copies) === 1 ? 'copy' : 'copies'} · {form.colour === 'colour' ? 'Colour' : 'Black and white'} ·{' '}
                        {form.sides === 'double' ? 'Double-sided' : 'Single-sided'} · {form.paperSize} · {paperTypeLabel(form.paperType)} · {finishingLabel(form.finishing)}
                      </dd>
                      {!created && <button type="button" className="text-link" style={{ background: 'none', borderTop: 0, borderLeft: 0, borderRight: 0 }} onClick={() => setStep(1)}>Change</button>}
                    </div>
                    <div>
                      <dt>Deliver to</dt>
                      <dd>
                        {form.recipientName} ({form.recipientPhone}), {form.address}, {form.area}
                        <br />
                        <span className="form-note">{form.instructions}</span>
                      </dd>
                      {!created && <button type="button" className="text-link" style={{ background: 'none', borderTop: 0, borderLeft: 0, borderRight: 0 }} onClick={() => setStep(2)}>Change</button>}
                    </div>
                  </dl>

                  {busy === 'uploading' && (
                    <div>
                      <p className="form-note" style={{ marginBottom: 8 }}>Encrypting and uploading your document… {progress}%</p>
                      <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                        <span style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}
                  {created && !busy && (
                    <div className="alert alert--success" role="status">
                      Order {created.ref} is saved. Continue to payment to send it to print.
                    </div>
                  )}
                  {serverError && (
                    <div className="alert" role="alert">
                      {serverError}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="step-actions">
              {step > 0 && !created ? (
                <button type="button" className="btn btn--outline" onClick={back} disabled={Boolean(busy)}>
                  Back
                </button>
              ) : (
                <span />
              )}
              {step < STEPS.length - 1 ? (
                <button type="button" className="btn btn--primary" onClick={next}>
                  Continue
                </button>
              ) : (
                <button type="button" className="btn btn--accent" onClick={placeOrder} disabled={Boolean(busy)}>
                  {busy ? <span className="spinner" aria-hidden="true" /> : <Icon.Lock />}
                  {busy === 'uploading' ? 'Uploading' : busy === 'paying' ? 'Opening payment' : estimate ? `Pay ${formatNaira(estimate.total)}` : 'Continue to payment'}
                </button>
              )}
            </div>
          </section>

          <aside className="summary" aria-label="Order summary">
            <h2>Summary</h2>
            {estimate ? (
              <>
                <dl>
                  <div>
                    <dt>Printing</dt>
                    <dd>{formatNaira(estimate.printing)}</dd>
                  </div>
                  {estimate.finishing > 0 && (
                    <div>
                      <dt>Finishing</dt>
                      <dd>{formatNaira(estimate.finishing)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Sealing</dt>
                    <dd>{formatNaira(estimate.sealing)}</dd>
                  </div>
                  <div>
                    <dt>Delivery</dt>
                    <dd>{formatNaira(estimate.delivery)}</dd>
                  </div>
                  {estimate.minimumTopUp > 0 && (
                    <div>
                      <dt>Minimum order top-up</dt>
                      <dd>{formatNaira(estimate.minimumTopUp)}</dd>
                    </div>
                  )}
                </dl>
                <div className="summary__total">
                  <span>{created ? 'Total' : 'Estimated total'}</span>
                  <strong>{formatNaira(estimate.total)}</strong>
                </div>
                {estimate.minimumTopUp > 0 && (
                  <p className="form-note" style={{ marginTop: 10 }}>
                    Orders start at {formatNaira(PRICING.minimumOrderKobo)}, delivery included.
                  </p>
                )}
                {!created && isPdf && <p className="form-note" style={{ marginTop: 10 }}>Confirmed once we count the pages in your PDF.</p>}
              </>
            ) : (
              <p className="form-note" style={{ marginTop: 14 }}>
                Your total appears here once we know the page count and delivery area.
              </p>
            )}
            <div className="summary__assurance">
              <span><Icon.Lock width={18} height={18} /> Encrypted upload and storage</span>
              <span><Icon.Seal width={18} height={18} /> Tamper-evident sealed envelope</span>
              <span><Icon.Clock width={18} height={18} /> File erased within 24 hours</span>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
