create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  role text not null check (role in ('admin', 'manager', 'user')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  department text default 'QA Automation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  customer_no text unique not null,
  name text not null,
  email text not null,
  company text not null,
  status text not null default 'Active' check (status in ('Active', 'Pending', 'Inactive')),
  tier text not null default 'Standard' check (tier in ('Standard', 'Gold', 'Platinum')),
  owner_id uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  category text not null,
  price numeric(10,2) not null default 0,
  stock integer not null default 0,
  status text not null default 'Active' check (status in ('Active', 'Draft', 'Discontinued')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,
  customer_id uuid references customers(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  assigned_user_id uuid references app_users(id) on delete set null,
  quantity integer not null default 1,
  amount numeric(10,2) not null default 0,
  status text not null default 'New' check (status in ('New', 'Processing', 'Shipped', 'Completed', 'Cancelled')),
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  actor_email text,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_customers_status on customers(status);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_assigned_user on orders(assigned_user_id);
create index if not exists idx_audit_created_at on audit_logs(created_at desc);
