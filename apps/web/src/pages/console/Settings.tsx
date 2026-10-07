import { useEffect, useState, type ChangeEvent } from 'react';
import {
  ZONES,
  FINISHING,
  type AddTeamMemberRequest,
  type AddTeamMemberResponse,
  type Colour,
  type DefaultDelivery,
  type FinishingId,
  type OrganizationPreferences,
  type OrganizationView,
  type PublicUser,
  type SettingsResponse,
  type TeamResponse,
  type UpdateOrganizationResponse
} from '@tesseract/shared';
import { api, errorMessage } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { useSession } from '../../lib/auth';
import { formatDate, initials } from '../../lib/format';
import { PageHead } from './ConsoleLayout';

type SectionId = 'organisation' | 'delivery' | 'preferences' | 'team' | 'profile' | 'security';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'organisation', label: 'Organisation' },
  { id: 'delivery', label: 'Delivery defaults' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'team', label: 'Team' },
  { id: 'profile', label: 'Your profile' },
  { id: 'security', label: 'Password' }
];

interface SaverState {
  busy: boolean;
  error: string;
  saved: boolean;
}

function useSaver(): [SaverState, <T>(fn: () => Promise<T>) => Promise<T | null>] {
  const [state, setState] = useState<SaverState>({ busy: false, error: '', saved: false });
  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setState({ busy: true, error: '', saved: false });
    try {
      const out = await fn();
      setState({ busy: false, error: '', saved: true });
      setTimeout(() => setState((s) => ({ ...s, saved: false })), 2500);
      return out;
    } catch (err) {
      setState({ busy: false, error: errorMessage(err), saved: false });
      return null;
    }
  }
  return [state, run];
}

interface ActionsProps {
  state: SaverState;
  label?: string;
  savedLabel?: string;
  disabled?: boolean;
}

function Actions({ state, label = 'Save changes', savedLabel = 'Changes saved', disabled }: ActionsProps) {
  return (
    <>
      {state.error && <div className="c-alert" role="alert">{state.error}</div>}
      <div className="form-actions">
        <button type="submit" className="c-btn c-btn--primary" disabled={state.busy || disabled}>
          {state.busy && <span className="spinner" aria-hidden="true" />}
          {label}
        </button>
        {state.saved && <span className="saved" role="status">{savedLabel}</span>}
      </div>
    </>
  );
}

interface OrgSectionProps {
  org: OrganizationView;
  canEdit: boolean;
  onSaved: (organization: OrganizationView) => void;
}

function Organisation({ org, canEdit, onSaved }: OrgSectionProps) {
  const [form, setForm] = useState({ name: org.name, billingEmail: org.billingEmail || '' });
  const [state, run] = useSaver();
  return (
    <form
      className="c-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(() => api<UpdateOrganizationResponse>('/enterprise/settings/organization', { method: 'PATCH', auth: true, body: form }));
        if (res) onSaved(res.organization);
      }}
    >
      <div className="c-field">
        <label htmlFor="org-name">Organisation name</label>
        <input id="org-name" className="c-input" disabled={!canEdit} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="c-field">
        <label htmlFor="org-billing">Billing email</label>
        <input id="org-billing" type="email" className="c-input" disabled={!canEdit} value={form.billingEmail} onChange={(e) => setForm({ ...form, billingEmail: e.target.value })} />
        <span className="hint">Monthly invoices are sent here.</span>
      </div>
      {canEdit ? <Actions state={state} /> : <p className="hint" style={{ color: 'var(--c-faint)' }}>Only owners and administrators can change these details.</p>}
    </form>
  );
}

function Delivery({ org, canEdit, onSaved }: OrgSectionProps) {
  const d = org.defaultDelivery ?? {};
  const [form, setForm] = useState<DefaultDelivery>({ recipientName: d.recipientName || '', phone: d.phone || '', area: d.area || '', address: d.address || '' });
  const [state, run] = useSaver();
  const set = (k: keyof DefaultDelivery) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <form
      className="c-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(() =>
          api<UpdateOrganizationResponse>('/enterprise/settings/organization', { method: 'PATCH', auth: true, body: { defaultDelivery: form } })
        );
        if (res) onSaved(res.organization);
      }}
    >
      <div className="c-form-grid">
        <div className="c-field">
          <label htmlFor="d-recipient">Recipient</label>
          <input id="d-recipient" className="c-input" disabled={!canEdit} value={form.recipientName} onChange={set('recipientName')} />
        </div>
        <div className="c-field">
          <label htmlFor="d-phone">Phone</label>
          <input id="d-phone" type="tel" className="c-input" disabled={!canEdit} value={form.phone} onChange={set('phone')} />
        </div>
        <div className="c-field">
          <label htmlFor="d-area">Area</label>
          <select id="d-area" className="c-input" disabled={!canEdit} value={form.area} onChange={set('area')}>
            <option value="">No default</option>
            {ZONES.map((z) => (
              <optgroup key={z.id} label={z.name}>
                {z.areas.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="c-field">
          <label htmlFor="d-address">Address</label>
          <input id="d-address" className="c-input" disabled={!canEdit} value={form.address} onChange={set('address')} />
        </div>
      </div>
      {canEdit && <Actions state={state} />}
    </form>
  );
}

function Preferences({ org, canEdit, onSaved }: OrgSectionProps) {
  const p = org.preferences ?? {};
  const [form, setForm] = useState<OrganizationPreferences>({
    notifyOnDispatch: p.notifyOnDispatch ?? true,
    notifyOnDelivery: p.notifyOnDelivery ?? true,
    defaultColour: p.defaultColour || 'mono',
    defaultFinishing: p.defaultFinishing || 'none'
  });
  const [state, run] = useSaver();
  return (
    <form
      className="c-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(() =>
          api<UpdateOrganizationResponse>('/enterprise/settings/organization', { method: 'PATCH', auth: true, body: { preferences: form } })
        );
        if (res) onSaved(res.organization);
      }}
    >
      <div className="panel" style={{ padding: '4px 20px' }}>
        <label className="switch">
          <span>
            <strong>Out for delivery</strong>
            <small>Email the person who placed an order when it leaves the print room.</small>
          </span>
          <input type="checkbox" disabled={!canEdit} checked={form.notifyOnDispatch} onChange={(e) => setForm({ ...form, notifyOnDispatch: e.target.checked })} />
        </label>
        <label className="switch">
          <span>
            <strong>Delivered</strong>
            <small>Email confirmation once the recipient has signed for the envelope.</small>
          </span>
          <input type="checkbox" disabled={!canEdit} checked={form.notifyOnDelivery} onChange={(e) => setForm({ ...form, notifyOnDelivery: e.target.checked })} />
        </label>
      </div>
      <div className="c-form-grid">
        <div className="c-field">
          <label htmlFor="p-colour">Default colour</label>
          <select id="p-colour" className="c-input" disabled={!canEdit} value={form.defaultColour} onChange={(e) => setForm({ ...form, defaultColour: e.target.value as Colour })}>
            <option value="mono">Black and white</option>
            <option value="colour">Colour</option>
          </select>
        </div>
        <div className="c-field">
          <label htmlFor="p-finishing">Default finishing</label>
          <select id="p-finishing" className="c-input" disabled={!canEdit} value={form.defaultFinishing} onChange={(e) => setForm({ ...form, defaultFinishing: e.target.value as FinishingId })}>
            {FINISHING.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>
      {canEdit && <Actions state={state} />}
    </form>
  );
}

function Team({ canEdit }: { canEdit: boolean }) {
  const [{ data, error }, setTeam] = useAsync((signal) => api<TeamResponse>('/enterprise/team', { auth: true, signal }), []);
  const [form, setForm] = useState<AddTeamMemberRequest>({ name: '', email: '', role: 'member', password: '' });
  const [state, run] = useSaver();
  const set = (k: 'name' | 'email' | 'password') => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="c-form">
      {error && <div className="c-alert">{error}</div>}
      <div className="table-wrap">
        <table className="c-table" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {(data?.members ?? []).map((m) => (
              <tr key={m.id}>
                <td>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className="avatar" aria-hidden="true">{initials(m.name)}</span>
                    <div>
                      {m.name}
                      <div className="muted">{m.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ textTransform: 'capitalize' }}>{m.role}</td>
                <td className="muted">{m.lastLoginAt ? formatDate(m.lastLoginAt) : 'Never'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <form
          className="panel c-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await run(() => api<AddTeamMemberResponse>('/enterprise/team', { method: 'POST', auth: true, body: form }));
            if (res) {
              setTeam((s) => ({ ...s, data: { members: [...(s.data?.members ?? []), res.member] } }));
              setForm({ name: '', email: '', role: 'member', password: '' });
            }
          }}
        >
          <div className="panel__head" style={{ marginBottom: 0 }}>
            <h2>Add a colleague</h2>
          </div>
          <div className="c-form-grid">
            <div className="c-field">
              <label htmlFor="t-name">Full name</label>
              <input id="t-name" className="c-input" required value={form.name} onChange={set('name')} />
            </div>
            <div className="c-field">
              <label htmlFor="t-email">Work email</label>
              <input id="t-email" type="email" className="c-input" required value={form.email} onChange={set('email')} />
            </div>
            <div className="c-field">
              <label htmlFor="t-role">Role</label>
              <select id="t-role" className="c-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value === 'admin' ? 'admin' : 'member' })}>
                <option value="member">Member: places and tracks orders</option>
                <option value="admin">Administrator: also manages settings and team</option>
              </select>
            </div>
            <div className="c-field">
              <label htmlFor="t-password">Temporary password</label>
              <input id="t-password" type="password" className="c-input" minLength={10} required value={form.password} onChange={set('password')} autoComplete="new-password" />
              <span className="hint">At least 10 characters. Share it privately; they can change it after signing in.</span>
            </div>
          </div>
          <Actions state={state} label="Add colleague" savedLabel="Colleague added" />
        </form>
      )}
    </div>
  );
}

function Profile() {
  const { user, updateUser } = useSession();
  const [name, setName] = useState(user.name);
  const [state, run] = useSaver();
  return (
    <form
      className="c-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(() => api<{ user: PublicUser }>('/enterprise/settings/profile', { method: 'PATCH', auth: true, body: { name } }));
        if (res) updateUser(res.user);
      }}
    >
      <div className="c-field">
        <label htmlFor="pr-name">Full name</label>
        <input id="pr-name" className="c-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="c-field">
        <label htmlFor="pr-email">Email</label>
        <input id="pr-email" className="c-input" value={user.email} disabled />
        <span className="hint">Contact your relationship manager to change the email on your account.</span>
      </div>
      <Actions state={state} />
    </form>
  );
}

function Security() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [state, run] = useSaver();
  const mismatch = form.confirm && form.confirm !== form.newPassword;
  return (
    <form
      className="c-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (mismatch) return;
        const res = await run(() =>
          api<{ ok: boolean }>('/enterprise/settings/password', { method: 'POST', auth: true, body: { currentPassword: form.currentPassword, newPassword: form.newPassword } })
        );
        if (res) setForm({ currentPassword: '', newPassword: '', confirm: '' });
      }}
    >
      <div className="c-field">
        <label htmlFor="s-current">Current password</label>
        <input id="s-current" type="password" className="c-input" autoComplete="current-password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
      </div>
      <div className="c-form-grid">
        <div className="c-field">
          <label htmlFor="s-new">New password</label>
          <input id="s-new" type="password" className="c-input" autoComplete="new-password" minLength={10} required value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          <span className="hint">At least 10 characters.</span>
        </div>
        <div className="c-field">
          <label htmlFor="s-confirm">Confirm new password</label>
          <input id="s-confirm" type="password" className="c-input" autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} aria-invalid={Boolean(mismatch)} />
          {mismatch && <span className="c-error">The passwords don’t match.</span>}
        </div>
      </div>
      <Actions state={state} label="Update password" savedLabel="Password updated" disabled={Boolean(mismatch)} />
    </form>
  );
}

export default function Settings() {
  const { user, updateOrganization } = useSession();
  const [section, setSection] = useState<SectionId>('organisation');
  const [{ loading, data, error }, setState] = useAsync((signal) => api<SettingsResponse>('/enterprise/settings', { auth: true, signal }), []);
  const canEdit = user.role === 'owner' || user.role === 'admin';

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    const match = SECTIONS.find((s) => s.id === fromHash);
    if (match) setSection(match.id);
  }, []);

  function onOrgSaved(organization: OrganizationView) {
    setState((s) => (s.data ? { ...s, data: { ...s.data, organization } } : s));
    updateOrganization({ id: organization.id, name: organization.name });
  }

  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]!;
  const descriptions: Record<SectionId, string> = {
    organisation: 'How your organisation appears on orders and invoices.',
    delivery: 'Used to prefill every new order. Anyone placing an order can still change it.',
    preferences: 'Notifications and the print settings new orders start with.',
    team: 'Everyone who can sign in to your organisation’s console.',
    profile: 'Your name as it appears on orders you place.',
    security: 'Choose a password you don’t use anywhere else.'
  };

  return (
    <>
      <PageHead title="Settings" />
      {error && <div className="c-alert" role="alert">{error}</div>}
      {loading && !data && <p style={{ color: 'var(--c-muted)' }}><span className="spinner" aria-hidden="true" /> Loading settings</p>}
      {data && (
        <div className="settings">
          <div className="settings__nav" role="tablist" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={s.id === section} onClick={() => setSection(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <section className="settings__section" role="tabpanel" aria-label={current.label}>
            <h2>{current.label}</h2>
            <p>{descriptions[section]}</p>
            {section === 'organisation' && <Organisation key={data.organization.name} org={data.organization} canEdit={canEdit} onSaved={onOrgSaved} />}
            {section === 'delivery' && <Delivery org={data.organization} canEdit={canEdit} onSaved={onOrgSaved} />}
            {section === 'preferences' && <Preferences org={data.organization} canEdit={canEdit} onSaved={onOrgSaved} />}
            {section === 'team' && <Team canEdit={canEdit} />}
            {section === 'profile' && <Profile />}
            {section === 'security' && <Security />}
          </section>
        </div>
      )}
    </>
  );
}
