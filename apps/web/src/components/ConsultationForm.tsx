import { useState, type ChangeEvent, type FormEvent } from 'react';
import { DOCUMENT_TYPES, type ConsultationRequest } from '@tesseract/shared';
import { api, errorMessage } from '../lib/api';

type ConsultationForm = Required<ConsultationRequest>;

const EMPTY: ConsultationForm = { name: '', institution: '', email: '', phone: '', documentType: DOCUMENT_TYPES[0], message: '' };

type FormState = { status: 'idle' | 'sending' | 'sent'; error: string };

export function ConsultationForm() {
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState<FormState>({ status: 'idle', error: '' });
  const set = (k: keyof ConsultationForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: 'sending', error: '' });
    try {
      const body: ConsultationRequest = { ...form, phone: form.phone || undefined };
      await api<{ ok: boolean }>('/consultations', { method: 'POST', body });
      setState({ status: 'sent', error: '' });
      setForm(EMPTY);
    } catch (err) {
      setState({ status: 'idle', error: errorMessage(err) });
    }
  }

  if (state.status === 'sent') {
    return (
      <div className="panel-form" role="status">
        <h3 style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.03em', color: 'var(--aubergine)' }}>Thank you. Your request is with us.</h3>
        <p className="body-lg" style={{ marginTop: 14 }}>
          A member of our team will contact you within one business day to arrange a private conversation.
        </p>
        <button type="button" className="text-link" style={{ marginTop: 24, background: 'none', borderTop: 0, borderLeft: 0, borderRight: 0 }} onClick={() => setState({ status: 'idle', error: '' })}>
          Send another request
        </button>
      </div>
    );
  }

  return (
    <form className="panel-form" onSubmit={submit}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="c-name">Full name</label>
          <input id="c-name" className="input" required minLength={2} autoComplete="name" value={form.name} onChange={set('name')} />
        </div>
        <div className="field">
          <label htmlFor="c-org">Institution</label>
          <input id="c-org" className="input" required minLength={2} autoComplete="organization" value={form.institution} onChange={set('institution')} />
        </div>
        <div className="field">
          <label htmlFor="c-email">Work email</label>
          <input id="c-email" type="email" className="input" required autoComplete="email" value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="c-phone">Phone (optional)</label>
          <input id="c-phone" type="tel" className="input" autoComplete="tel" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="field span-2">
          <label htmlFor="c-type">Nature of documents</label>
          <select id="c-type" className="input" value={form.documentType} onChange={set('documentType')}>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field span-2">
          <label htmlFor="c-msg">How can we help?</label>
          <textarea id="c-msg" className="input" rows={4} maxLength={2000} value={form.message} onChange={set('message')} />
        </div>
        {state.error && (
          <div className="alert span-2" role="alert">
            {state.error}
          </div>
        )}
        <div className="span-2">
          <button type="submit" className="btn btn--primary btn--block" disabled={state.status === 'sending'}>
            {state.status === 'sending' ? <span className="spinner" aria-hidden="true" /> : null}
            {state.status === 'sending' ? 'Sending request' : 'Request a consultation'}
          </button>
          <p className="form-note" style={{ marginTop: 12 }}>
            Your enquiry is treated in confidence and used only to respond to you.
          </p>
        </div>
      </div>
    </form>
  );
}
