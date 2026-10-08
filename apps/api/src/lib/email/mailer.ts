// Sends email through Resend or any SMTP server, and records every attempt in the EmailLog.
// With neither configured (local development), messages are logged and recorded as "skipped".
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../../config.js';
import { EmailLog, type EmailLogDocument } from '../../models/EmailLog.js';
import type { RenderedEmail } from './templates.js';

type Provider = 'resend' | 'smtp' | 'log';

export const emailProvider: Provider = config.email.resendApiKey ? 'resend' : config.email.smtpUrl ? 'smtp' : 'log';

let smtp: Transporter | null = null;

interface Outgoing extends RenderedEmail {
  to: string;
}

async function deliver(msg: Outgoing): Promise<string | undefined> {
  const { from, replyTo } = config.email;
  if (emailProvider === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.email.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(15000)
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) throw new Error(body.message || `Resend responded ${res.status}`);
    return body.id;
  }
  if (emailProvider === 'smtp') {
    smtp ??= nodemailer.createTransport(config.email.smtpUrl);
    const info = await smtp.sendMail({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, ...(replyTo ? { replyTo } : {}) });
    return info.messageId;
  }
  return undefined;
}

export interface SendOptions {
  to: string;
  template: string;
  email: RenderedEmail;
  order?: { _id: string; ref: string } | null;
}

let logger: { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void } = {
  info: (obj, msg) => console.log(msg, obj),
  warn: (obj, msg) => console.warn(msg, obj)
};

export function setMailLogger(log: typeof logger): void {
  logger = log;
}

/** Sends one email and records the outcome. Never throws: a failed email must not fail the request that caused it. */
export async function sendEmail({ to, template, email, order = null }: SendOptions): Promise<EmailLogDocument | null> {
  if (!to) return null;
  let status: 'sent' | 'failed' | 'skipped' = emailProvider === 'log' ? 'skipped' : 'sent';
  let providerId: string | undefined;
  let error: string | undefined;
  try {
    providerId = await deliver({ ...email, to });
    if (emailProvider === 'log') logger.info({ to, subject: email.subject, template }, 'email not sent: no email provider configured');
  } catch (err) {
    status = 'failed';
    error = (err as Error).message?.slice(0, 500) || 'Unknown error';
    logger.warn({ to, template, error }, 'email failed');
  }
  try {
    return await EmailLog.create({
      to,
      subject: email.subject,
      template,
      order: order?._id ?? null,
      orderRef: order?.ref,
      status,
      provider: emailProvider,
      providerId,
      error,
      html: email.html,
      text: email.text
    });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'could not record email');
    return null;
  }
}

/** Sends a recorded email again, to the same recipient, and records the new attempt. */
export async function resendEmail(id: string): Promise<EmailLogDocument | null> {
  const prev = await EmailLog.findById(id).select('+html +text');
  if (!prev) return null;
  return sendEmail({
    to: prev.to,
    template: prev.template,
    email: { subject: prev.subject, html: prev.html, text: prev.text },
    order: prev.order && prev.orderRef ? { _id: prev.order, ref: prev.orderRef } : null
  });
}
