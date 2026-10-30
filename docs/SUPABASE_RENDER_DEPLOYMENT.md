# Deploy V3 App to Render with Supabase Postgres

## 1. Create Supabase project

Create a Supabase project, then open:

```text
Project Settings -> Database -> Connection string
```

Copy the URI connection string. For Render, the pooler/session URI is usually easiest because many cloud platforms are IPv4-only.

Example format:

```text
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

## 2. Create GitHub repository

```powershell
cd C:\DevPlaywright\playwright-production-demo-app-v3-supabase-rbac
git init
git add .
git commit -m "Initial V3 Supabase RBAC app"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/playwright-production-demo-app-v3-supabase-rbac.git
git push -u origin main
```

## 3. Create Render Web Service

Use these settings:

```text
Runtime: Node
Build Command: npm install && npm run db:schema && npm run db:seed
Start Command: npm start
```

Environment variables:

```text
DATABASE_URL=<your Supabase connection string>
JWT_SECRET=<long random secret>
NODE_ENV=production
```

Render provides `PORT` automatically.

## 4. Verify deployment

Open:

```text
https://your-render-app.onrender.com/api/health
```

Expected result:

```json
{
  "success": true,
  "database": "connected"
}
```

Then open:

```text
https://your-render-app.onrender.com/login
```

Use:

```text
admin@example.com / password123
manager@example.com / manager123
user@example.com / user123
```

## 5. Important production note

This is a demo app. Before using it for any real data:

- Change seeded passwords.
- Use stronger secrets.
- Add rate limiting.
- Add CSRF protection if you switch to cookie auth.
- Add server-side audit retention.
- Use proper password reset workflows.
- Use migrations instead of seed-on-every-build.
