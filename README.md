# DebtIQ

DebtIQ is a mobile-first financial opportunity intelligence MVP for tracking debts, monthly obligations, cash flow, and matched financing opportunities.

## Stack

- Next.js 15
- TypeScript
- Tailwind CSS
- Supabase-ready auth and database model
- Recharts
- PWA manifest
- Mobile-first responsive UI with dark mode

## MVP Coverage

- Register/login/reset UI and secure session integration point
- Dynamic income sources: salary, rent, housing allowance, business, consulting, commission, and other
- Debt center for personal loans, credit cards, mortgages, auto finance, and other debt
- Dynamic obligations module with categories and monthly amounts
- Dashboard KPI cards for income, obligations, debt, cash flow, debt score, pressure score, and available cash flow
- Debt score engine with Green, Yellow, and Red bands
- Opportunities center and automatic income/debt matching
- Lead request consent modal and lead creation
- Admin panel for offer management, leads, users, and statistics
- Role-based navigation: standard users see only Dashboard, Income, Obligations, Debt Center, Goals, Profile, and Opportunities
- Separate `/admin` login and protected `/admin/dashboard` for admin users
- Arabic and English-ready layout copy

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Demo mode is enabled by default through `NEXT_PUBLIC_DEBTIQ_DEMO_MODE=true`, so the dashboard displays sample debts, obligations, offers, and matched opportunities without Supabase login.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Set `NEXT_PUBLIC_DEBTIQ_DEMO_MODE=false` when replacing demo data with live Supabase-backed data.

The UI currently uses in-memory seed data so it can be reviewed immediately. The Supabase client and schema are ready for wiring persistence into the same data shapes.

## Admin Access

Set server-only admin credentials in `.env.local`:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
```

Admin login is available at `http://localhost:3000/admin`. Protected admin routes return `403 Unauthorized` without a valid admin session.
