# Playwright Production Demo App V3
A production-style local/cloud demo application for Playwright UI automation and API automation.

## Features

- Node.js + Express app
- Supabase Postgres database using `DATABASE_URL`
- JWT login
- Role-based access control
- Admin page
- Manager pages
- User pages
- Dynamic dashboard
- Customer CRUD
- Product CRUD
- Order workflow
- Reports page
- API explorer page
- Modern UI components page
- Dedicated iframe lab page
- Shadow DOM widget
- File upload API
- Delay API and status-code API
- Playwright UI tests
- Playwright API tests
- Render deployment files

## Demo users

| Role | Email | Password |
|---|---|---|
| Admin | admin@example.com | password123 |
| Manager | manager@example.com | manager123 |
| User | user@example.com | user123 |

## Local setup

### 1. Install packages

```powershell
cd C:\DevPlaywright\playwright-production-demo-app-v3-supabase-rbac
npm install
```

### 2. Create `.env`

Copy `.env.example` to `.env`.

```powershell
copy .env.example .env
```

Edit `.env` and set your Supabase Postgres connection string:

```env
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
JWT_SECRET=replace_this_with_a_long_random_secret
PORT=3001
```

### 3. Create database tables and seed data

```powershell
npm run db:schema
npm run db:seed
```

### 4. Start app

```powershell
npm start
```

Open:

```text
http://localhost:3001
```

## App pages

```text
/login
/dashboard
/admin
/users
/customers
/orders
/products
/reports
/components
/iframe-lab
/api-explorer
/settings
```

## Role-based behavior

| Page | Admin | Manager | User |
|---|---:|---:|---:|
| Dashboard | Yes | Yes | Yes |
| Admin Console | Yes | No | No |
| User Portal | Yes | Yes | Yes |
| Customers | Yes | Yes | No |
| Orders | Yes | Yes | No, only My Orders in User Portal |
| Products | Yes | Yes | No |
| Reports | Yes | Yes | No |
| Components | Yes | Yes | Yes |
| Iframe Lab | Yes | Yes | Yes |
| API Explorer | Yes | Yes | Yes |
| Settings | Yes | Yes | Yes |

## API examples

Health:

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/health"
```

Login:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3001/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"admin@example.com","password":"password123"}'
```

## Run tests

Install browser:

```powershell
npm run install:browsers
```

Run all tests:

```powershell
npm test
```

Run UI tests:

```powershell
npm run test:ui
```

Run API tests:

```powershell
npm run test:api
```

Run headed:

```powershell
npm run test:headed
```

## Render deployment

1. Push this repo to GitHub.
2. Create a Supabase project and copy the Postgres connection string.
3. In Render, create a Web Service from the GitHub repo.
4. Add environment variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NODE_ENV=production`
5. Build command:

```bash
npm install && npm run db:schema && npm run db:seed
```

6. Start command:

```bash
npm start
```

Render supplies `PORT`, so do not hardcode the port.

## Notes

This project uses direct SQL through the `pg` library. Supabase is used as the hosted Postgres database. This keeps the app closer to a real enterprise Node.js backend while still being simple enough for automation practice.
