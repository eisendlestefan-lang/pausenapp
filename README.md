# Pausenapp

Deploy-ready Vite + React + TypeScript Projekt fuer die Pausenapp.

## Lokal starten

```bash
npm install
cp .env.example .env
npm run dev
```

`.env` ausfuellen:

```env
VITE_SUPABASE_URL=https://gvcelpwrkjsflegimolt.supabase.co
VITE_SUPABASE_ANON_KEY=dein_publishable_anon_key
VITE_ADMIN_EMAIL=eisendlestefan@gmail.com
VITE_ADMIN_NAME=Stefan Eisendle
VITE_BAKERY_EMAIL=eisendlestefan@gmail.com
VITE_PAYPAL_PAYMENT_LINK=https://www.paypal.com/ncp/payment/8FV3GWW3RQQ9A
VITE_BANK_RECIPIENT=Raiffeisenkasse Wipptal
VITE_BANK_IBAN=IT32A0818259110000300279609
VITE_BANK_BIC=
VITE_EMAIL_FUNCTION_NAME=email-versand
```

## GitHub Upload

1. ZIP entpacken.
2. In dein Repository `eisendlestefan-lang/pausenapp` hochladen.
3. Keine `.env` Datei hochladen.
4. Commit message: `Initial deploy-ready Pausenapp`.

## Vercel oder Netlify

- GitHub Repo importieren.
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables aus `.env.example` in Vercel/Netlify eintragen.

## Supabase

1. `supabase/sql/schema.sql` im Supabase SQL Editor ausfuehren.
2. Edge Function `email-versand` anlegen/deployen.
3. Secrets setzen:
   - `RESEND_API_KEY`
   - `EMAIL_FROM` optional, z.B. `Pausenapp <onboarding@resend.dev>`
4. Supabase Auth URL Configuration nach Deployment setzen:
   - Site URL: `https://deine-live-url`
   - Redirect URLs: `https://deine-live-url/**`

## Edge Function Reminder

Die Function unter `supabase/functions/email-versand/index.ts` unterstuetzt:

- `order_confirmation`
- `payment_confirmed`
- `payment_reminder`
- `deadline_reminder`
- `bakery_production_list`
