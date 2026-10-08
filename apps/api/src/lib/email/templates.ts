// Transactional email templates. Table layout and inline styles so they render the same in
// Gmail, Outlook, Apple Mail and Yahoo; every template also ships a plain-text version.
import { finishingLabel, formatNaira, type Quote } from '@tesseract/shared';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const C = {
  aubergine: '#2B1442',
  deep: '#1C0B2B',
  violet: '#4B2384',
  lilac: '#CDB8DD',
  lilacSoft: '#F1EBF7',
  ink: '#160E1C',
  muted: '#6B6172',
  line: '#EBE6EF',
  page: '#F4F1F7',
  ok: '#2F6B4F',
  okSoft: '#E8F3EC',
  warn: '#8A5A12',
  warnSoft: '#FBF3E4'
};
const FONT = "'Figtree','Helvetica Neue',Helvetica,Arial,sans-serif";

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─────────── Building blocks ─────────── */

const p = (html: string, style = '') =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.ink};${style}">${html}</p>`;

const h1 = (text: string) =>
  `<h1 style="margin:0 0 14px;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:${C.ink};">${esc(text)}</h1>`;

const eyebrow = (text: string, colour = C.violet) =>
  `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${colour};">${esc(text)}</p>`;

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr>
<td style="border-radius:6px;background:${C.aubergine};">
<a href="${esc(href)}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${esc(label)}</a>
</td></tr></table>`;
}

/** Key/value rows, e.g. an order summary. Values are trusted HTML; escape them first. */
function rows(items: [string, string][]): string {
  const tr = items
    .map(
      ([k, v], i) => `<tr>
<td style="padding:12px 0;${i ? `border-top:1px solid ${C.line};` : ''}font-family:${FONT};font-size:14px;color:${C.muted};vertical-align:top;width:42%;">${esc(k)}</td>
<td style="padding:12px 0;${i ? `border-top:1px solid ${C.line};` : ''}font-family:${FONT};font-size:14px;color:${C.ink};font-weight:500;text-align:right;vertical-align:top;">${v}</td>
</tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">${tr}</table>`;
}

function card(inner: string, bg = C.lilacSoft, border = C.lilac): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
<tr><td style="padding:22px 24px;background:${bg};border:1px solid ${border};border-radius:10px;">${inner}</td></tr></table>`;
}

function codeCard(code: string): string {
  const spaced = code.split('').join('&nbsp;');
  return card(
    `${eyebrow('Your handover code')}
<p style="margin:0 0 10px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:0.18em;color:${C.aubergine};">${spaced}</p>
<p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.muted};">Give this code to the courier only once the sealed envelope is in your hands. It is how we confirm delivery. Our staff will never ask for it by phone.</p>`
  );
}

function steps(current: number): string {
  const labels = ['Received', 'Printing', 'Sealed', 'On its way', 'Delivered'];
  const cells = labels
    .map((label, i) => {
      const done = i <= current;
      const colour = done ? C.aubergine : C.line;
      const text = done ? C.ink : C.muted;
      return `<td style="padding:0 2px;width:20%;vertical-align:top;">
<div style="height:4px;border-radius:2px;background:${colour};font-size:0;line-height:0;">&nbsp;</div>
<p style="margin:8px 0 0;font-family:${FONT};font-size:11.5px;font-weight:${i === current ? 700 : 500};color:${text};">${label}</p></td>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 28px;"><tr>${cells}</tr></table>`;
}

interface LayoutInput {
  preheader: string;
  body: string;
  /** Small print under the body, e.g. why they received this. */
  footnote?: string;
}

function layout({ preheader, body, footnote }: LayoutInput): string {
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Tesseract Prints</title>
<style>
  @media (max-width:620px){ .px{padding-left:22px!important;padding-right:22px!important;} .card{border-radius:0!important;} }
  a{color:${C.violet};}
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;">
    <tr><td class="px" style="padding:26px 40px;background:${C.aubergine};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="width:34px;height:34px;background:#ffffff;border-radius:8px;text-align:center;vertical-align:middle;font-family:Arial,sans-serif;font-size:18px;line-height:34px;color:${C.aubergine};">&#9635;</td>
        <td style="padding-left:12px;font-family:${FONT};font-size:19px;color:#ffffff;letter-spacing:-0.01em;"><strong style="font-weight:600;">Tesseract</strong> <span style="font-weight:300;opacity:0.85;">Prints</span></td>
      </tr></table>
    </td></tr>
    <tr><td class="px" style="padding:38px 40px 14px;">${body}</td></tr>
    <tr><td class="px" style="padding:22px 40px 30px;border-top:1px solid ${C.line};">
      ${footnote ? `<p style="margin:0 0 12px;font-family:${FONT};font-size:13px;line-height:1.55;color:${C.muted};">${footnote}</p>` : ''}
      <p style="margin:0;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${C.muted};">Tesseract Prints · Confidential document printing and delivery · Abuja<br>Every document is handled by one person, sealed by hand, and erased once it reaches you.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

/** Strips the HTML to a readable plain-text fallback. */
function lines(...parts: (string | false | null | undefined)[]): string {
  return [...parts.filter(Boolean), '', '—', 'Tesseract Prints · Confidential document printing and delivery · Abuja'].join('\n');
}

/* ─────────── Order data shared by the templates ─────────── */

export interface OrderEmailData {
  ref: string;
  title: string;
  customerName: string;
  recipientName: string;
  recipientPhone?: string;
  area: string;
  address?: string;
  directions?: string;
  channel: 'express' | 'enterprise';
  pages: number;
  copies: number;
  colour: 'mono' | 'colour';
  sides: 'single' | 'double';
  paperSize: string;
  paperType?: string;
  finishing: string;
  quote: Quote;
  paid: boolean;
  handoverCode?: string;
  trackUrl: string;
  rider?: { name: string; phone: string; eta?: Date | null };
  eta?: string;
}

const first = (name: string) => esc(name.trim().split(/\s+/)[0] || 'there');

function jobLine(o: OrderEmailData): string {
  return `${o.pages} ${o.pages === 1 ? 'page' : 'pages'} × ${o.copies} ${o.copies === 1 ? 'copy' : 'copies'} · ${o.colour === 'colour' ? 'Colour' : 'Black & white'} · ${o.sides === 'double' ? 'Double-sided' : 'Single-sided'} · ${o.paperSize}${o.paperType === 'special' ? ' · Special paper' : ''}`;
}

function summaryRows(o: OrderEmailData, withMoney = true): string {
  const items: [string, string][] = [
    ['Order', `<span style="font-family:Menlo,Consolas,monospace;letter-spacing:0.04em;">${esc(o.ref)}</span>`],
    ['Document', esc(o.title)],
    ['Printing', esc(jobLine(o))]
  ];
  if (o.finishing !== 'none') items.push(['Finishing', esc(finishingLabel(o.finishing))]);
  items.push(['Delivering to', `${esc(o.recipientName)}<br><span style="color:${C.muted};font-weight:400;">${esc(o.area)}</span>`]);
  if (withMoney) {
    items.push([o.channel === 'enterprise' ? 'Invoiced to your account' : o.paid ? 'Paid' : 'Total', `<strong>${esc(formatNaira(o.quote.total))}</strong>`]);
  }
  return rows(items);
}

function receiptRows(o: OrderEmailData): string {
  const q = o.quote;
  const items: [string, string][] = [['Printing', esc(formatNaira(q.printing))]];
  if (q.finishing) items.push(['Finishing', esc(formatNaira(q.finishing))]);
  items.push(['Sealing', esc(formatNaira(q.sealing))], ['Delivery', esc(formatNaira(q.delivery))]);
  if (q.minimumTopUp) items.push(['Minimum order adjustment', esc(formatNaira(q.minimumTopUp))]);
  items.push(['Total', `<strong style="font-size:16px;">${esc(formatNaira(q.total))}</strong>`]);
  return rows(items);
}

const formatTime = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(d);

/* ─────────── Invoice data shared by the templates ─────────── */

export interface InvoiceEmailData {
  number: string;
  organizationName: string;
  periodLabel: string;
  total: number;
  orders: number;
  issuedAt: Date;
  dueAt: Date;
  /** Private link to view and pay the invoice without signing in. */
  payUrl: string;
  bankDetails: string;
  lines: { ref: string; title: string; total: number }[];
  paidAt?: Date;
  methodLabel?: string;
}

const formatDay = (d: Date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' }).format(d);

const MAX_EMAIL_LINES = 8;

function invoiceLineRows(i: InvoiceEmailData): string {
  const shown = i.lines.slice(0, MAX_EMAIL_LINES);
  const items: [string, string][] = shown.map((l) => [
    l.ref,
    `${esc(l.title)}<br><span style="color:${C.muted};font-weight:400;">${esc(formatNaira(l.total))}</span>`
  ]);
  if (i.lines.length > shown.length) items.push([`And ${i.lines.length - shown.length} more`, 'Listed on the invoice']);
  items.push(['Total', `<strong style="font-size:16px;">${esc(formatNaira(i.total))}</strong>`]);
  return rows(items);
}

function bankCard(i: InvoiceEmailData): string {
  if (!i.bankDetails) return '';
  return card(
    `${eyebrow('Prefer a bank transfer?', C.muted)}
<p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.ink};">${esc(i.bankDetails).replace(/\n/g, '<br>')}<br>Use <strong>${esc(i.number)}</strong> as the payment reference.</p>`,
    '#ffffff',
    C.line
  );
}

/* ─────────── Templates ─────────── */

export const templates = {
  order_confirmed(o: OrderEmailData): RenderedEmail {
    const subject = `Order ${o.ref} confirmed: we’re preparing your documents`;
    const lead =
      o.channel === 'enterprise'
        ? 'Your order is in the print room and will be invoiced to your organisation.'
        : 'Payment received. Your order is in the print room.';
    return {
      subject,
      html: layout({
        preheader: `${lead} Keep your handover code safe.`,
        body: `${eyebrow('Order confirmed')}${h1(`Thank you, ${first(o.customerName)}.`)}
${p(`${esc(lead)} One member of our team will print, check and seal it by hand, then bring it to ${esc(o.recipientName)} in ${esc(o.area)}.`)}
${steps(0)}
${o.handoverCode ? codeCard(o.handoverCode) : ''}
${summaryRows(o)}
${button(o.channel === 'enterprise' ? 'View order in your console' : 'Track your order', o.trackUrl)}
${p(`Your file is encrypted on arrival and erased automatically within 24 hours, or as soon as the order is delivered.`, `font-size:14px;color:${C.muted};`)}`,
        footnote:
          o.channel === 'express'
            ? 'Your tracking link is private: anyone with it can see this order. Please don’t forward this email.'
            : 'You’re receiving this because the order was placed from your Tesseract Prints account.'
      }),
      text: lines(
        `Order ${o.ref} confirmed`,
        '',
        `Thank you, ${o.customerName.split(' ')[0]}. ${lead}`,
        o.handoverCode && `Handover code: ${o.handoverCode} (give it to the courier only once the sealed envelope is in your hands)`,
        '',
        `Document: ${o.title}`,
        `Printing: ${jobLine(o)}`,
        `Delivering to: ${o.recipientName}, ${o.area}`,
        `Total: ${formatNaira(o.quote.total)}`,
        '',
        `Track your order: ${o.trackUrl}`
      )
    };
  },

  out_for_delivery(o: OrderEmailData): RenderedEmail {
    const eta = o.rider?.eta ? `around ${formatTime(o.rider.eta)}` : 'shortly';
    const subject = `On its way: order ${o.ref} arrives ${eta}`;
    const riderCard = o.rider
      ? card(
          `${eyebrow('Your courier')}
<p style="margin:0 0 4px;font-family:${FONT};font-size:18px;font-weight:600;color:${C.ink};">${esc(o.rider.name)}</p>
<p style="margin:0;font-family:${FONT};font-size:15px;color:${C.ink};"><a href="tel:${esc(o.rider.phone.replace(/[^\d+]/g, ''))}" style="color:${C.violet};text-decoration:none;font-weight:600;">${esc(o.rider.phone)}</a>${o.rider.eta ? ` · expected ${esc(formatTime(o.rider.eta))}` : ''}</p>`,
          '#FFFFFF',
          C.line
        )
      : '';
    return {
      subject,
      html: layout({
        preheader: `Your sealed envelope has left the print room and should arrive ${eta}.`,
        body: `${eyebrow('Out for delivery')}${h1('Your documents are on their way.')}
${p(`Hello ${first(o.customerName)}, the sealed envelope for <strong>${esc(o.title)}</strong> has left the print room and is heading to ${esc(o.recipientName)} in ${esc(o.area)}. It should arrive ${esc(eta)}.`)}
${steps(3)}
${riderCard}
${o.handoverCode ? codeCard(o.handoverCode) : ''}
${p(`<strong>Before you hand over the code,</strong> check that the envelope’s seal is intact. If it looks opened or damaged, don’t accept it. Call us and we’ll reprint at no cost.`, 'font-size:15px;')}
${button('Follow the delivery', o.trackUrl)}`
      }),
      text: lines(
        `Order ${o.ref} is out for delivery`,
        '',
        `Your sealed envelope is heading to ${o.recipientName} in ${o.area}. It should arrive ${eta}.`,
        o.rider && `Courier: ${o.rider.name}, ${o.rider.phone}`,
        o.handoverCode && `Handover code: ${o.handoverCode}`,
        'Check the seal is intact before giving the code.',
        '',
        `Follow the delivery: ${o.trackUrl}`
      )
    };
  },

  delivery_update(o: OrderEmailData & { message: string }): RenderedEmail {
    const subject = `Update on order ${o.ref}`;
    return {
      subject,
      html: layout({
        preheader: o.message.slice(0, 120),
        body: `${eyebrow('Delivery update')}${h1(`An update on your order`)}
${p(`Hello ${first(o.customerName)}, here’s the latest on <strong>${esc(o.title)}</strong> (${esc(o.ref)}):`)}
${card(`<p style="margin:0;font-family:${FONT};font-size:17px;line-height:1.55;color:${C.ink};">${esc(o.message).replace(/\n/g, '<br>')}</p>`)}
${o.rider ? p(`Your courier is <strong>${esc(o.rider.name)}</strong>, on <a href="tel:${esc(o.rider.phone.replace(/[^\d+]/g, ''))}">${esc(o.rider.phone)}</a>.`) : ''}
${button('See all updates', o.trackUrl)}`
      }),
      text: lines(`Update on order ${o.ref}`, '', o.message, o.rider && `Courier: ${o.rider.name}, ${o.rider.phone}`, '', `See all updates: ${o.trackUrl}`)
    };
  },

  delivered(o: OrderEmailData & { deliveredAt: Date }): RenderedEmail {
    const subject = `Delivered: order ${o.ref}`;
    const when = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Lagos'
    }).format(o.deliveredAt);
    return {
      subject,
      html: layout({
        preheader: `Handed to ${o.recipientName} on ${when}. Your file has been erased.`,
        body: `${eyebrow('Delivered', C.ok)}${h1('Delivered and signed for.')}
${p(`Hello ${first(o.customerName)}, the sealed envelope for <strong>${esc(o.title)}</strong> was handed to ${esc(o.recipientName)} on ${esc(when)}, confirmed with your handover code.`)}
${steps(4)}
${card(
  `<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.ok};"><strong>Your file has been erased.</strong> We’ve permanently deleted the uploaded document from our systems. Only the delivery record remains.</p>`,
  C.okSoft,
  '#CFE6D8'
)}
${eyebrow(o.channel === 'enterprise' ? 'Charged to your account' : 'Receipt', C.muted)}
${receiptRows(o)}
${p(`Something not right? Reply to this email within 7 days and we’ll put it right.`, `font-size:14px;color:${C.muted};`)}
${o.channel === 'express' ? button('Place another order', o.trackUrl.replace(/\/track\/.*$/, '/express')) : ''}`
      }),
      text: lines(
        `Order ${o.ref} delivered`,
        '',
        `Handed to ${o.recipientName} on ${when}, confirmed with your handover code.`,
        'Your file has been permanently erased.',
        '',
        `Total: ${formatNaira(o.quote.total)}`,
        'Something not right? Reply within 7 days.'
      )
    };
  },

  cancelled(o: OrderEmailData & { reason: string }): RenderedEmail {
    const subject = `Order ${o.ref} has been cancelled`;
    return {
      subject,
      html: layout({
        preheader: 'Your order was cancelled and your file erased.',
        body: `${eyebrow('Cancelled', C.muted)}${h1('Your order has been cancelled.')}
${p(`Hello ${first(o.customerName)}, order <strong>${esc(o.ref)}</strong> (${esc(o.title)}) has been cancelled${o.reason ? ':' : '.'}`)}
${o.reason ? card(`<p style="margin:0;font-family:${FONT};font-size:16px;line-height:1.55;color:${C.ink};">${esc(o.reason)}</p>`, C.warnSoft, '#EBD9B4') : ''}
${p('Your uploaded file has been erased. Nothing was printed for delivery.')}
${o.paid ? p(`<strong>Your refund of ${esc(formatNaira(o.quote.total))}</strong> will be processed to your original payment method within 5 working days.`) : ''}
${p(`Questions? Just reply to this email.`, `font-size:14px;color:${C.muted};`)}`
      }),
      text: lines(
        `Order ${o.ref} cancelled`,
        '',
        o.reason,
        'Your file has been erased.',
        o.paid && `Your refund of ${formatNaira(o.quote.total)} will be processed within 5 working days.`
      )
    };
  },

  ops_new_order(o: OrderEmailData & { consoleUrl: string }): RenderedEmail {
    const subject = `New ${o.channel === 'express' ? 'express' : 'account'} order ${o.ref} · ${o.area} · ${formatNaira(o.quote.total)}`;
    return {
      subject,
      html: layout({
        preheader: `${jobLine(o)} for ${o.recipientName}, ${o.area}.`,
        body: `${eyebrow('New order in the queue')}${h1(`${o.ref} · ${o.title}`)}
${rows([
  ['Customer', esc(o.customerName)],
  ['Job', esc(jobLine(o))],
  ['Finishing', esc(finishingLabel(o.finishing))],
  ['Deliver to', `${esc(o.recipientName)}${o.recipientPhone ? ` · <a href="tel:${esc(o.recipientPhone.replace(/[^\d+]/g, ''))}">${esc(o.recipientPhone)}</a>` : ''}<br>${esc(o.address ?? '')}<br><span style="color:${C.muted};font-weight:400;">${esc(o.area)}</span>`],
  ['Directions', esc(o.directions || '—')],
  ['Value', `<strong>${esc(formatNaira(o.quote.total))}</strong> · ${o.channel === 'express' ? 'paid' : 'invoiced'}`]
])}
${button('Open in the print room', o.consoleUrl)}
${p('The file is erased automatically 24 hours after upload. Print it before then.', `font-size:14px;color:${C.muted};`)}`,
        footnote: 'Internal alert for the Tesseract Prints print room.'
      }),
      text: lines(`New order ${o.ref}`, jobLine(o), `Deliver to: ${o.recipientName}, ${o.address ?? ''}, ${o.area}`, `Value: ${formatNaira(o.quote.total)}`, o.consoleUrl)
    };
  },

  invoice_issued(i: InvoiceEmailData): RenderedEmail {
    const subject = `Invoice ${i.number} for ${i.periodLabel}: ${formatNaira(i.total)}`;
    return {
      subject,
      html: layout({
        preheader: `${i.orders} ${i.orders === 1 ? 'order' : 'orders'} in ${i.periodLabel}, due ${formatDay(i.dueAt)}.`,
        body: `${eyebrow('Monthly invoice')}${h1(`Your ${i.periodLabel} invoice`)}
${p(`Here is ${esc(i.organizationName)}’s invoice for the ${i.orders} ${i.orders === 1 ? 'order' : 'orders'} you sent to print in ${esc(i.periodLabel)}. Payment is due by <strong>${esc(formatDay(i.dueAt))}</strong>.`)}
${rows([
  ['Invoice', `<span style="font-family:Menlo,Consolas,monospace;letter-spacing:0.04em;">${esc(i.number)}</span>`],
  ['Issued', esc(formatDay(i.issuedAt))],
  ['Due', `<strong>${esc(formatDay(i.dueAt))}</strong>`]
])}
${invoiceLineRows(i)}
${button(`Pay ${formatNaira(i.total)}`, i.payUrl)}
${bankCard(i)}
${p('Pay by card or bank transfer through our secure payment partner. A receipt is emailed as soon as payment arrives.', `font-size:14px;color:${C.muted};`)}`,
        footnote: 'This link opens your invoice without signing in. Share it only with whoever settles your account.'
      }),
      text: lines(
        `Invoice ${i.number} for ${i.periodLabel}`,
        '',
        `${i.organizationName}: ${i.orders} ${i.orders === 1 ? 'order' : 'orders'}, total ${formatNaira(i.total)}.`,
        `Due by ${formatDay(i.dueAt)}.`,
        '',
        `View and pay: ${i.payUrl}`,
        i.bankDetails && `\nBank transfer:\n${i.bankDetails}\nReference: ${i.number}`
      )
    };
  },

  invoice_reminder(i: InvoiceEmailData): RenderedEmail {
    const subject = `Reminder: invoice ${i.number} is overdue`;
    return {
      subject,
      html: layout({
        preheader: `${formatNaira(i.total)} for ${i.periodLabel} was due on ${formatDay(i.dueAt)}.`,
        body: `${eyebrow('Payment reminder', C.warn)}${h1('Your invoice is overdue.')}
${p(`Invoice <strong>${esc(i.number)}</strong> for ${esc(i.periodLabel)} was due on ${esc(formatDay(i.dueAt))} and we haven’t received payment yet. If you’ve already paid, thank you, and please ignore this email.`)}
${card(
  `<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.warn};"><strong>${esc(formatNaira(i.total))}</strong> outstanding for ${i.orders} ${i.orders === 1 ? 'order' : 'orders'}.</p>`,
  C.warnSoft,
  '#F0DDB8'
)}
${button(`Pay ${formatNaira(i.total)}`, i.payUrl)}
${bankCard(i)}`,
        footnote: 'Questions about this invoice? Reply to this email and we’ll help.'
      }),
      text: lines(
        `Invoice ${i.number} is overdue`,
        '',
        `${formatNaira(i.total)} for ${i.periodLabel} was due on ${formatDay(i.dueAt)}.`,
        '',
        `View and pay: ${i.payUrl}`,
        i.bankDetails && `\nBank transfer:\n${i.bankDetails}\nReference: ${i.number}`
      )
    };
  },

  invoice_paid(i: InvoiceEmailData): RenderedEmail {
    const subject = `Receipt: invoice ${i.number} paid`;
    const when = formatDay(i.paidAt ?? new Date());
    return {
      subject,
      html: layout({
        preheader: `${formatNaira(i.total)} received on ${when}. Thank you.`,
        body: `${eyebrow('Payment received', C.ok)}${h1('Thank you. Your invoice is paid.')}
${p(`We received ${esc(formatNaira(i.total))} for invoice <strong>${esc(i.number)}</strong> (${esc(i.periodLabel)}) on ${esc(when)}${i.methodLabel ? ` by ${esc(i.methodLabel)}` : ''}.`)}
${invoiceLineRows(i)}
${button('View invoice', i.payUrl)}`,
        footnote: 'Keep this email as your receipt.'
      }),
      text: lines(`Invoice ${i.number} paid`, '', `${formatNaira(i.total)} received on ${when}. Thank you.`, '', `View invoice: ${i.payUrl}`)
    };
  },

  consultation_received(c: ConsultationEmailData): RenderedEmail {
    const subject = 'We’ve received your enquiry · Tesseract Prints';
    return {
      subject,
      html: layout({
        preheader: 'A member of our team will be in touch within one working day.',
        body: `${eyebrow('Enquiry received')}${h1(`Thank you, ${first(c.name)}.`)}
${p(`We’ve received your enquiry for <strong>${esc(c.institution)}</strong>. A member of our team will contact you within one working day to discuss your requirements.`)}
${c.documentType || c.message ? card(`${c.documentType ? `${eyebrow('Document type', C.muted)}<p style="margin:0 0 ${c.message ? 14 : 0}px;font-family:${FONT};font-size:15px;color:${C.ink};">${esc(c.documentType)}</p>` : ''}${c.message ? `${eyebrow('Your message', C.muted)}<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.ink};">${esc(c.message).replace(/\n/g, '<br>')}</p>` : ''}`, '#FFFFFF', C.line) : ''}
${p('In the meantime, you can send a one-off document right away with express printing, no account needed.')}
${button('Try express printing', `${c.webUrl}/express`)}`
      }),
      text: lines(
        `Thank you, ${c.name.split(' ')[0]}.`,
        `We’ve received your enquiry for ${c.institution}. We’ll contact you within one working day.`,
        '',
        `Express printing: ${c.webUrl}/express`
      )
    };
  },

  ops_consultation(c: ConsultationEmailData): RenderedEmail {
    return {
      subject: `New enquiry: ${c.institution} (${c.name})`,
      html: layout({
        preheader: c.message?.slice(0, 120) || `${c.name} from ${c.institution}`,
        body: `${eyebrow('New enquiry')}${h1(c.institution)}
${rows([
  ['Name', esc(c.name)],
  ['Email', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`],
  ['Phone', c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '—'],
  ['Document type', esc(c.documentType || '—')]
])}
${c.message ? card(`<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.ink};">${esc(c.message).replace(/\n/g, '<br>')}</p>`, '#FFFFFF', C.line) : ''}
${p('Reply within one working day, as promised on the site.', `font-size:14px;color:${C.muted};`)}`,
        footnote: 'Internal alert for the Tesseract Prints team.'
      }),
      text: lines(`New enquiry from ${c.name}, ${c.institution}`, `Email: ${c.email}`, c.phone && `Phone: ${c.phone}`, c.documentType && `Type: ${c.documentType}`, '', c.message)
    };
  }
};

export interface ConsultationEmailData {
  name: string;
  institution: string;
  email: string;
  phone?: string;
  documentType?: string;
  message?: string;
  webUrl: string;
}

export type TemplateId = keyof typeof templates;

export const TEMPLATE_INFO: { id: TemplateId; name: string; description: string }[] = [
  { id: 'order_confirmed', name: 'Order confirmed', description: 'Sent when an express order is paid or an account order is placed. Carries the handover code.' },
  { id: 'out_for_delivery', name: 'Out for delivery', description: 'Sent when the envelope leaves the print room, with the courier’s name, phone and ETA.' },
  { id: 'delivery_update', name: 'Delivery update', description: 'Sent when the print room posts an update and chooses to notify the customer.' },
  { id: 'delivered', name: 'Delivered', description: 'Receipt and confirmation that the file has been erased.' },
  { id: 'cancelled', name: 'Cancelled', description: 'Sent when an order is cancelled, with the reason and any refund.' },
  { id: 'invoice_issued', name: 'Monthly invoice', description: 'Sent on the 1st to each organisation’s billing email, with a private link to view and pay.' },
  { id: 'invoice_reminder', name: 'Invoice overdue', description: 'Sent once when an invoice passes its due date unpaid.' },
  { id: 'invoice_paid', name: 'Invoice receipt', description: 'Sent when an invoice is paid online or marked paid by the print room.' },
  { id: 'consultation_received', name: 'Enquiry received', description: 'Acknowledges a consultation request from the website.' },
  { id: 'ops_new_order', name: 'Print room: new order', description: 'Internal alert to OPS_EMAIL for every paid or invoiced order.' },
  { id: 'ops_consultation', name: 'Print room: new enquiry', description: 'Internal alert to OPS_EMAIL for every website enquiry.' }
];

/** Realistic sample data so each template can be previewed from the console. */
export function sampleEmail(id: TemplateId, webUrl: string): RenderedEmail {
  const order: OrderEmailData = {
    ref: 'TP-7K3Q9XA',
    title: 'FCTA tender submission, Lot 3',
    customerName: 'Amaka Okafor',
    recipientName: 'Amaka Okafor',
    area: 'Maitama',
    address: '14 Gana Street',
    recipientPhone: '+234 803 555 0101',
    directions: 'White gate opposite the filling station. Third floor, reception.',
    channel: 'express',
    pages: 48,
    copies: 3,
    colour: 'mono',
    sides: 'double',
    paperSize: 'A4',
    finishing: 'spiral',
    quote: { currency: 'NGN', printing: 1_440_000, finishing: 450_000, delivery: 300_000, sealing: 50_000, minimumTopUp: 0, total: 2_240_000, sheets: 72 },
    paid: true,
    handoverCode: '482913',
    trackUrl: `${webUrl}/track/TP-7K3Q9XA?t=sample`,
    rider: { name: 'Ibrahim Musa', phone: '+234 803 555 0142', eta: new Date(Date.now() + 45 * 60 * 1000) }
  };
  const consultation: ConsultationEmailData = {
    name: 'Tunde Bakare',
    institution: 'Bakare & Partners Chambers',
    email: 'tunde@bakarepartners.ng',
    phone: '+234 809 555 0199',
    documentType: 'Legal bundles & filings',
    message: 'We file court bundles weekly at the Federal High Court and need a reliable, confidential partner.',
    webUrl
  };
  const invoice: InvoiceEmailData = {
    number: 'INV-202609-7KQ3X',
    organizationName: 'Bakare & Partners Chambers',
    periodLabel: 'September 2026',
    total: 18_450_000,
    orders: 3,
    issuedAt: new Date(),
    dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    payUrl: `${webUrl}/invoice/INV-202609-7KQ3X?t=sample`,
    bankDetails: 'Tesseract Prints Ltd\nGTBank · 0123456789',
    lines: [
      { ref: 'TP-7K3Q9XA', title: 'FCTA tender submission, Lot 3', total: 2_240_000 },
      { ref: 'TP-M4RW2LC', title: 'Court bundle, Suit FHC/ABJ/CS/1182/2026', total: 11_610_000 },
      { ref: 'TP-Q8ZD5HN', title: 'Board pack, Q3 review', total: 4_600_000 }
    ],
    paidAt: new Date(),
    methodLabel: 'card through Bachs'
  };
  switch (id) {
    case 'invoice_issued':
      return templates.invoice_issued(invoice);
    case 'invoice_reminder':
      return templates.invoice_reminder({ ...invoice, dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) });
    case 'invoice_paid':
      return templates.invoice_paid(invoice);
    case 'order_confirmed':
      return templates.order_confirmed(order);
    case 'out_for_delivery':
      return templates.out_for_delivery(order);
    case 'delivery_update':
      return templates.delivery_update({ ...order, message: 'Ibrahim is stuck in traffic at Berger Junction and is now about 20 minutes away. Sorry for the delay.' });
    case 'delivered':
      return templates.delivered({ ...order, deliveredAt: new Date() });
    case 'cancelled':
      return templates.cancelled({ ...order, reason: 'The file you uploaded was password-protected, so we couldn’t print it. Please place the order again with an unlocked copy.' });
    case 'ops_new_order':
      return templates.ops_new_order({ ...order, consoleUrl: `${webUrl}/console/ops/orders/TP-7K3Q9XA` });
    case 'consultation_received':
      return templates.consultation_received(consultation);
    case 'ops_consultation':
      return templates.ops_consultation(consultation);
  }
}
