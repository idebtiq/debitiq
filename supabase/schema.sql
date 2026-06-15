create extension if not exists "pgcrypto";

create type debt_type as enum ('Personal Loan', 'Credit Card', 'Mortgage', 'Auto Finance', 'Other Debt');
create type offer_type as enum ('Debt Transfer', 'Refinancing', 'Personal Loan', 'Mortgage', 'Auto Finance');
create type app_role as enum ('consumer', 'admin');
create type income_type as enum ('Salary', 'Rent', 'Housing Allowance', 'Business', 'Consulting', 'Commission', 'Bonus', 'Other');
create type obligation_category as enum ('Loan', 'Credit Card', 'Education', 'Housing', 'Children', 'Domestic Worker', 'Vehicle', 'Insurance', 'Lifestyle', 'Other');
create type obligation_frequency as enum ('Monthly', 'One-Time', 'Annual');
create type obligation_allocation_method as enum ('Count full amount only in due month', 'Spread amount monthly until due date');
create type lead_status as enum ('New', 'Contacted', 'In Progress', 'Closed', 'Rejected');
create type goal_type as enum ('Pay Off Credit Card', 'Pay Off Debt', 'Buy Car', 'Buy Home', 'Emergency Fund', 'School Fees', 'Business Fund', 'Travel', 'Other');
create type goal_priority as enum ('High', 'Medium', 'Low');
create type marital_status as enum ('Single', 'Married', 'Divorced', 'Widowed', 'Prefer not to say');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'consumer',
  full_name text not null,
  mobile text not null,
  email text not null,
  country text,
  city text,
  employer text,
  marital_status marital_status,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  income_name text not null,
  income_amount numeric not null default 0,
  income_type income_type not null default 'Other',
  expected_month text,
  guaranteed boolean,
  recurring boolean,
  allocation text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  debt_type debt_type not null,
  debt_name text not null,
  bank text not null,
  remaining_balance numeric not null default 0,
  monthly_installment numeric not null default 0,
  interest_rate numeric not null default 0,
  end_date date,
  credit_limit numeric,
  created_at timestamptz not null default now()
);

create table public.obligation_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  obligation_name text not null,
  monthly_amount numeric not null default 0,
  category obligation_category not null default 'Other',
  due_day integer not null default 1 check (due_day between 1 and 31),
  is_recurring boolean not null default true,
  frequency obligation_frequency not null default 'Monthly',
  due_date date,
  start_date date,
  end_date date,
  allocation_method obligation_allocation_method not null default 'Count full amount only in due month',
  saved_amount numeric not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_name text not null,
  provider text not null,
  credit_limit numeric not null default 0,
  current_balance numeric not null default 0,
  available_credit numeric generated always as (greatest(credit_limit - current_balance, 0)) stored,
  utilization numeric generated always as (
    case when credit_limit > 0 then (current_balance / credit_limit) * 100 else 0 end
  ) stored,
  minimum_payment_due numeric not null default 0,
  statement_total_due numeric not null default 0,
  due_date date not null,
  apr_or_profit_rate numeric not null default 0,
  is_maxed_out boolean generated always as (
    case when credit_limit > 0 then (current_balance / credit_limit) >= 0.95 else false end
  ) stored,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  goal_type goal_type not null default 'Other',
  target_amount numeric not null default 0,
  current_amount numeric not null default 0,
  target_date date,
  priority goal_priority not null default 'Medium',
  notes text not null default '',
  linked_debt_id uuid references public.debts(id) on delete set null,
  linked_credit_card_id uuid references public.credit_cards(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  offer_type offer_type not null,
  title text not null,
  bank_name text not null,
  description text not null,
  min_salary numeric not null default 0,
  max_salary numeric not null default 999999999,
  min_debt numeric not null default 0,
  max_debt numeric not null default 999999999,
  expiry_date date not null,
  contact_person text not null,
  contact_number text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  user_name text not null,
  mobile text not null,
  email text not null,
  offer_selected text not null,
  consent_approved boolean not null default false,
  status lead_status not null default 'New',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.income_sources enable row level security;
alter table public.debts enable row level security;
alter table public.obligation_entries enable row level security;
alter table public.credit_cards enable row level security;
alter table public.goals enable row level security;
alter table public.offers enable row level security;
alter table public.leads enable row level security;

create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can read own income sources" on public.income_sources for select using (auth.uid() = user_id);
create policy "Users can manage own income sources" on public.income_sources for all using (auth.uid() = user_id);
create policy "Users can read own debts" on public.debts for select using (auth.uid() = user_id);
create policy "Users can manage own debts" on public.debts for all using (auth.uid() = user_id);
create policy "Users can read own obligations" on public.obligation_entries for select using (auth.uid() = user_id);
create policy "Users can manage own obligations" on public.obligation_entries for all using (auth.uid() = user_id);
create policy "Users can read own credit cards" on public.credit_cards for select using (auth.uid() = user_id);
create policy "Users can manage own credit cards" on public.credit_cards for all using (auth.uid() = user_id);
create policy "Users can read own goals" on public.goals for select using (auth.uid() = user_id);
create policy "Users can manage own goals" on public.goals for all using (auth.uid() = user_id);
create policy "Authenticated users can read active offers" on public.offers for select using (auth.role() = 'authenticated');
create policy "Users can create own consented leads" on public.leads for insert with check (auth.uid() = user_id and consent_approved = true);
create policy "Users can read own leads" on public.leads for select using (auth.uid() = user_id);

create policy "Admins manage profiles" on public.profiles for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "Admins manage income sources" on public.income_sources for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "Admins manage debts" on public.debts for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "Admins manage obligations" on public.obligation_entries for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "Admins manage credit cards" on public.credit_cards for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "Admins manage goals" on public.goals for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "Admins manage offers" on public.offers for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "Admins manage leads" on public.leads for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
