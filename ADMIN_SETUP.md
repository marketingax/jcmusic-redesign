# JC Music — Admin Dashboard Setup

The admin dashboard lives at **`/admin`** and is powered by serverless functions in **`/api`**
that proxy the GoHighLevel API. The GHL token is **never** exposed to the browser — it lives
only in environment variables on the server.

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (for Production,
Preview, and Development). For local dev they go in `.env.local` (gitignored).

| Variable | What it is |
|---|---|
| `GHL_PRIVATE_TOKEN` | GoHighLevel Private Integration Token (`pit-...`) |
| `GHL_LOCATION_ID`   | GHL sub-account / location id — `t5OUz0ZAKdemEM54g4L8` |
| `GHL_CALENDAR_ID`   | Booking calendar id — `r4KLd8050gT9in8Hkww7` |
| `ADMIN_PASSWORD`    | Password JC types to log into `/admin` |
| `SESSION_SECRET`    | Random string for signing login cookies (`openssl rand -hex 32`) |

After changing any variable in Vercel, **redeploy** for it to take effect.

## Rotating the GHL token (do this periodically, or if it leaks)

1. In GHL → **Settings → Private Integrations**, create a new token (or regenerate).
2. In Vercel → Settings → Environment Variables, edit `GHL_PRIVATE_TOKEN`, paste the new value.
3. Redeploy. Delete the old token in GHL.

Because the token is only ever an env var, rotating it never touches the codebase and it is
never committed to git.

## Required GHL token scopes

Contacts, Calendars, Opportunities, Conversations, Forms — read.
**Invoices + Payments — read** (`payments/orders.readonly`, `payments/transactions.readonly`).
If the Invoices view is empty or the dashboard warns about payments, add those scopes to the
Private Integration and redeploy.

## Local development

```
cp .env.example .env.local   # then fill in real values
npx vercel dev               # runs the static site + /api functions locally
```

## Endpoints

- `POST /api/login` · `POST /api/logout` · `GET /api/session`
- `GET /api/summary` · `/api/contacts` · `/api/appointments` · `/api/conversations`
  · `/api/opportunities` · `/api/invoices`

All data endpoints require a valid session cookie.
