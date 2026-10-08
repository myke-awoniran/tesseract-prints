# Tesseract Prints

Confidential document printing, sealing and delivery for institutions in Abuja.

```
tesseract-prints/
├── apps/
│   ├── api/        Fastify 5 + MongoDB (Mongoose) API — TypeScript, run with tsx in dev, compiled with tsc for production
│   └── web/        React 18 + Vite — TypeScript (.tsx): marketing site, express checkout, client console
├── packages/
│   └── shared/     TypeScript domain rules and API types used by both: zones, statuses, pricing, request/response shapes
└── tsconfig.base.json   Strict compiler settings every package extends
```

Everything is TypeScript in strict mode. The API and the web app share one set of types from `@tesseract/shared`
(`OrderView`, `StatsResponse`, `SettingsResponse` and so on), so a change to a response shape is caught on both sides at compile time.

## What's included

**Website** (`/`): hero slideshow, services, institutions, governance, engagement process, tabbed FAQs and a consultation form that saves enquiries to MongoDB. No prices appear on the marketing pages.

**Express printing** (`/express`): no account needed. Upload → print options → delivery → review and pay (Bachs, or Paystack as a fallback). The customer gets a private tracking link (`/track/:ref?t=…`) showing progress and a six-digit handover code.

**Client console** (`/console`, black theme):
- Sign in (JWT, 8-hour sessions)
- Overview: orders this month, in progress, pages, invoiced amount, six-month chart, status breakdown, recent orders
- Orders: filter, search, paginate; order detail with timeline and handover code
- New order: invoiced to the organisation, prefilled from delivery defaults
- Settings: organisation, delivery defaults, preferences, team (add colleagues), profile, password
- Print queue (operator role): download documents (logged), move orders through printing → sealed → out for delivery, and confirm delivery with the recipient's handover code

## File security and the 24-hour expiry

Uploads are encrypted with AES-256-GCM (`FILE_ENCRYPTION_KEY`) and stored in two collections, `storedfiles` and `filechunks`. Both schemas declare

```js
createdAt: { type: Date, default: Date.now, expires: FILE_TTL_SECONDS } // 24 hours
```

which creates a MongoDB TTL index, so the database deletes every file 24 hours after upload with no cron job. The API also calls `createIndexes()` on boot so the TTL index exists even with `autoIndex` off. Files are erased immediately when delivery is confirmed or an order is cancelled; the order record is kept, the document is not. Note that MongoDB's TTL monitor runs about once a minute, so deletion happens within a minute or two of the 24-hour mark.

Every download and status change is written to `accesslogs`.

## Getting started

Requirements: Node 20.11+, and MongoDB 6+ (local, Docker or Atlas).

```bash
npm install                           # also builds packages/shared (postinstall)
npm run db:up                         # optional: starts MongoDB in Docker
cp apps/api/.env.example apps/api/.env  # then fill in the secrets
npm run seed                          # creates a demo organisation, an owner and an operator; prints the password
npm run dev                           # shared (tsc --watch), API on :4000 (tsx watch), web on :5173 (Vite proxies /api)
npm run typecheck                     # strict type check across all packages
```

Open http://localhost:5173. Sign in to the console with the seeded accounts:
the owner sees the client console; the operator sees the print queue.

### Payments

Payments go through **Bachs** by default; **Paystack** is a drop-in fallback. `PAYMENT_PROVIDER` (`bachs` or `paystack`) picks the gateway for new checkouts. Each order remembers the gateway it was sent to, and both webhooks stay active, so switching never strands a payment already in progress.

With the active gateway's key empty, development uses **mock payments**: "Pay" returns straight to the confirmation page and marks the order paid. The API refuses to start in production without a real key.

**Bachs (primary).** In [app.bachs.io](https://app.bachs.io) → Developer Portal:

1. Create a secret key with the `payments:read` and `payments:write` scopes and set `BACHS_SECRET_KEY`. `sk_sandbox_…` keys talk to the sandbox; `sk_live_…` keys take real money (your account must be verified first).
2. Under Webhooks, add `https://your-domain/api/payments/bachs/webhook`, subscribe to `collection.succeeded` and `checkout.completed`, and copy the signing secret into `BACHS_WEBHOOK_SECRET` (required in production).

Checkouts are hosted by Bachs, priced in NGN. Customers who back out return to a page where they can try again; unpaid orders also show a pay button on their tracking page.

**Paystack (fallback).** Set `PAYSTACK_SECRET_KEY` and add this webhook URL in the Paystack dashboard:

```
https://your-domain/api/payments/paystack/webhook
```

Payments are confirmed twice (return page and webhook), always by asking the gateway directly, and checked against the order's amount and currency; marking an order paid is idempotent.

### Monthly invoices (account organisations)

Organisation orders skip checkout and go straight to the print queue. On the 1st of each month (Lagos time) the API issues one invoice per organisation for the previous month's orders, due in 14 days, and emails it to the organisation's billing email (or its owners if none is set). The email carries a private link to view and pay the invoice without signing in; console users can also pay from **Billing**. Payment goes through the active gateway (Bachs by default) and is confirmed the same way as express orders. One reminder is sent when an invoice becomes overdue.

The print room manages invoices under **Invoices** in the console: record a bank transfer, void and re-issue, resend, or bill last month immediately. Billing is idempotent: a month is never billed twice for the same organisation.

- `BILLING_START` (`YYYY-MM`, default `2026-10`): the first month invoiced. Earlier orders are never billed.
- `BILLING_BANK_DETAILS`: optional bank details printed on invoices for clients who pay by transfer.

### Production

```bash
npm run build                          # tsc for shared and API (to dist/), tsc + vite build for web
# in apps/api/.env: NODE_ENV=production, WEB_DIST=../web/dist, real secrets
npm start                              # node apps/api/dist/server.js serves the API and the site
```

Put it behind HTTPS (e.g. Caddy or Nginx). Use MongoDB Atlas or a replica set with backups. Back up `FILE_ENCRYPTION_KEY` safely: if it is lost, stored files cannot be decrypted (they expire within 24 hours anyway).

## Things to set before launch

- **Prices**: `packages/shared/src/domain.ts` → `PRICING` holds example values in kobo. Set your real rates.
- **Contact details and copy**: `apps/web/src/content/site.ts`.
- **Photos**: see `apps/web/public/images/README.md`. Slides whose image file is missing are skipped automatically.
- **Font**: the site uses Figtree (Google Fonts). Matter is a commercial typeface from Displaay and is not on Google Fonts. If you license it, put the `.woff2` files in `apps/web/public/fonts/`, add `@font-face` rules to `apps/web/src/styles/global.css`, and change `--font`.
- **Email**: notification preferences are saved, but no emails are sent yet. Connect a provider (Resend, Postmark, Mailgun) where orders change status in `apps/api/src/lib/orders.ts`, and send express customers their tracking link by email.
- **Legal**: privacy notice and terms pages, and compliance with the Nigeria Data Protection Act for the data you hold.

## API overview

| Method | Path | Who |
| --- | --- | --- |
| GET | `/api/health` | anyone |
| POST | `/api/consultations` | anyone |
| POST | `/api/express/orders` (multipart) | anyone |
| POST | `/api/express/orders/:ref/pay` | holder of the order token |
| GET | `/api/payments/verify?checkout_id=` or `?reference=` | anyone |
| POST | `/api/payments/bachs/webhook` | Bachs (signature checked) |
| POST | `/api/payments/paystack/webhook` | Paystack (signature checked) |
| GET | `/api/track/:ref?t=` | holder of the order token |
| GET, POST | `/api/invoices/:number?t=`, `/api/invoices/:number/pay` | holder of the invoice link |
| GET, POST | `/api/enterprise/invoices`, `/enterprise/invoices/:number`, `/:number/pay` | client users |
| GET, POST | `/api/ops/invoices`, `/ops/invoices/:number`, `/mark-paid`, `/void`, `/resend`, `/api/ops/billing/run` | operators |
| POST | `/api/auth/login`, GET `/api/auth/me` | users |
| GET | `/api/enterprise/stats`, `/orders`, `/orders/:ref`, `/settings`, `/team` | client users |
| POST | `/api/enterprise/orders` (multipart), `/team`, `/settings/password` | client users (team: owner/admin) |
| PATCH | `/api/enterprise/settings/organization`, `/settings/profile` | owner/admin; any user |
| GET | `/api/ops/queue`, `/ops/orders/:ref/file`, `/ops/orders/:ref/log` | operators |
| POST | `/api/ops/orders/:ref/status` | operators |

Rate limits apply globally and more tightly to login, uploads and the consultation form.
