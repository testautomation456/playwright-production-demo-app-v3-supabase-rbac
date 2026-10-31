require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { query, ping } = require('./src/db');
const { signUser, requireAuth, requireRole } = require('./src/auth');

const app = express();

// Express 4 does not catch rejected promises from async handlers; forward them to the error middleware.
['get', 'post', 'put', 'delete'].forEach((method) => {
  const original = app[method].bind(app);
  app[method] = (path, ...handlers) => {
    if (method === 'get' && handlers.length === 0) return original(path);
    return original(path, ...handlers.map((h) => (typeof h === 'function' && h.constructor.name === 'AsyncFunction'
      ? (req, res, next) => h(req, res, next).catch(next)
      : h)));
  };
});

const VALID_ROLES = ['admin', 'manager', 'user'];
const PORT = process.env.PORT || 3000;
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

app.set('trust proxy', 1); // Render terminates TLS in front of the app
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false })); // pages use inline scripts, so CSP stays off for now

// Same-origin by default; set CORS_ORIGINS=https://a.com,https://b.com to allow other origins.
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : { origin: false }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT || (process.env.NODE_ENV === 'production' ? 20 : 1000)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts, try again later' }
});
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/assets', express.static(path.join(__dirname, 'public')));

function page(fileName) {
  return path.join(__dirname, 'public', 'pages', fileName);
}

function sendAppPage(fileName) {
  return (_req, res) => res.sendFile(page(fileName));
}

async function audit(req, action, entityType, entityId = null, details = {}) {
  try {
    await query(
      `insert into audit_logs (actor_email, actor_role, action, entity_type, entity_id, details)
       values ($1, $2, $3, $4, $5, $6)`,
      [req.user?.email || 'anonymous', req.user?.role || 'anonymous', action, entityType, entityId, details]
    );
  } catch (error) {
    console.warn('Audit log failed:', error.message);
  }
}

app.get('/', (_req, res) => res.redirect('/login'));
app.get('/login', sendAppPage('login.html'));
app.get('/dashboard', sendAppPage('dashboard.html'));
app.get('/admin', sendAppPage('admin.html'));
app.get('/users', sendAppPage('users.html'));
app.get('/customers', sendAppPage('customers.html'));
app.get('/orders', sendAppPage('orders.html'));
app.get('/products', sendAppPage('products.html'));
app.get('/reports', sendAppPage('reports.html'));
app.get('/components', sendAppPage('components.html'));
app.get('/iframe-lab', sendAppPage('iframe-lab.html'));
app.get('/api-explorer', sendAppPage('api-explorer.html'));
app.get('/settings', sendAppPage('settings.html'));
app.get('/iframe-content', sendAppPage('iframe-content.html'));

app.get('/api/health', async (_req, res) => {
  try {
    const db = await ping();
    res.json({ success: true, app: 'Playwright Production Demo V3', database: 'connected', db });
  } catch (error) {
    res.status(503).json({ success: false, app: 'Playwright Production Demo V3', database: 'not connected', error: error.message });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { username, email, password } = req.body;
  const login = username || email;

  if (!login || !password) {
    return res.status(400).json({ success: false, error: 'Email/username and password are required' });
  }

  const result = await query('select * from app_users where lower(email)=lower($1) and status=$2', [login, 'active']);
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid username or password' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ success: false, error: 'Invalid username or password' });
  }

  const token = signUser(user);
  await query(
    `insert into audit_logs (actor_email, actor_role, action, entity_type, entity_id, details)
     values ($1, $2, 'LOGIN', 'user', $3, $4)`,
    [user.email, user.role, user.id, { method: 'password' }]
  );

  res.json({
    success: true,
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department }
  });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const result = await query('select id, name, email, role, status, department, created_at from app_users where id=$1', [req.user.sub]);
  if (!result.rows[0]) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({ success: true, user: result.rows[0] });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  const [customers, orders, products, users, myOrders] = await Promise.all([
    query('select count(*)::int as count from customers'),
    query('select count(*)::int as count, coalesce(sum(amount),0)::numeric(10,2) as revenue from orders'),
    query('select count(*)::int as count from products'),
    query('select count(*)::int as count from app_users'),
    query('select count(*)::int as count from orders where assigned_user_id=$1', [req.user.sub])
  ]);
  res.json({
    success: true,
    metrics: {
      customers: customers.rows[0].count,
      orders: orders.rows[0].count,
      revenue: orders.rows[0].revenue,
      products: products.rows[0].count,
      users: users.rows[0].count,
      myOrders: myOrders.rows[0].count
    }
  });
});

// Admin user management
app.get('/api/admin/users', requireAuth, requireRole('admin'), async (_req, res) => {
  const result = await query('select id, name, email, role, status, department, created_at from app_users order by created_at desc');
  res.json({ success: true, users: result.rows });
});

app.post('/api/admin/users', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, email, password, role, status = 'active', department = 'QA Automation' } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, error: 'name, email, password, and role are required' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }
  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    `insert into app_users (name, email, password_hash, role, status, department)
     values ($1,$2,$3,$4,$5,$6)
     returning id, name, email, role, status, department, created_at`,
    [name, email, hash, role, status, department]
  );
  await audit(req, 'CREATE_USER', 'user', result.rows[0].id, { email, role });
  res.status(201).json({ success: true, user: result.rows[0] });
});

app.put('/api/admin/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, role, status, department } = req.body;
  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }
  const result = await query(
    `update app_users set
      name = coalesce($1, name),
      role = coalesce($2, role),
      status = coalesce($3, status),
      department = coalesce($4, department),
      updated_at = now()
     where id=$5
     returning id, name, email, role, status, department, created_at`,
    [name, role, status, department, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ success: false, error: 'User not found' });
  await audit(req, 'UPDATE_USER', 'user', req.params.id, req.body);
  res.json({ success: true, user: result.rows[0] });
});

app.delete('/api/admin/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const result = await query('update app_users set status=$1, updated_at=now() where id=$2 returning id, email, status', ['disabled', req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ success: false, error: 'User not found' });
  await audit(req, 'DISABLE_USER', 'user', req.params.id, {});
  res.json({ success: true, user: result.rows[0] });
});

app.get('/api/admin/audit', requireAuth, requireRole('admin'), async (_req, res) => {
  const result = await query('select * from audit_logs order by created_at desc limit 50');
  res.json({ success: true, audit: result.rows });
});

app.get('/api/admin/stats', requireAuth, requireRole('admin'), async (_req, res) => {
  const result = await query(`
    select role, count(*)::int as count
    from app_users
    group by role
    order by role
  `);
  const orders = await query(`select status, count(*)::int as count from orders group by status order by status`);
  res.json({ success: true, userRoles: result.rows, orderStatuses: orders.rows });
});

// User self-service pages
app.get('/api/user/profile', requireAuth, async (req, res) => {
  const result = await query('select id, name, email, role, status, department, created_at from app_users where id=$1', [req.user.sub]);
  res.json({ success: true, profile: result.rows[0] });
});

app.put('/api/user/profile', requireAuth, async (req, res) => {
  const { name, department } = req.body;
  const result = await query(
    `update app_users set name=coalesce($1,name), department=coalesce($2,department), updated_at=now()
     where id=$3 returning id, name, email, role, status, department`,
    [name, department, req.user.sub]
  );
  await audit(req, 'UPDATE_PROFILE', 'user', req.user.sub, { name, department });
  res.json({ success: true, profile: result.rows[0] });
});

app.get('/api/user/orders', requireAuth, async (req, res) => {
  const result = await query(
    `select o.*, c.name as customer_name, p.name as product_name
     from orders o
     left join customers c on c.id=o.customer_id
     left join products p on p.id=o.product_id
     where o.assigned_user_id=$1
     order by o.created_at desc`,
    [req.user.sub]
  );
  res.json({ success: true, orders: result.rows });
});

// Customers CRUD - admin/manager can write; all roles can read filtered views.
app.get('/api/customers', requireAuth, async (req, res) => {
  const search = `%${req.query.search || ''}%`;
  const status = req.query.status || null;
  const result = await query(
    `select c.*, u.name as owner_name
     from customers c
     left join app_users u on u.id=c.owner_id
     where ($1::text is null or c.status=$1)
       and (c.name ilike $2 or c.email ilike $2 or c.company ilike $2 or c.customer_no ilike $2)
     order by c.created_at desc`,
    [status, search]
  );
  res.json({ success: true, customers: result.rows });
});

app.post('/api/customers', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { customer_no, name, email, company, status = 'Active', tier = 'Standard', owner_id = req.user.sub } = req.body;
  if (!customer_no || !name || !email || !company) return res.status(400).json({ success: false, error: 'customer_no, name, email, company are required' });
  const result = await query(
    `insert into customers (customer_no, name, email, company, status, tier, owner_id)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [customer_no, name, email, company, status, tier, owner_id]
  );
  await audit(req, 'CREATE_CUSTOMER', 'customer', result.rows[0].id, req.body);
  res.status(201).json({ success: true, customer: result.rows[0] });
});

app.put('/api/customers/:id', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { name, email, company, status, tier } = req.body;
  const result = await query(
    `update customers set name=coalesce($1,name), email=coalesce($2,email), company=coalesce($3,company),
      status=coalesce($4,status), tier=coalesce($5,tier), updated_at=now()
     where id=$6 returning *`,
    [name, email, company, status, tier, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Customer not found' });
  await audit(req, 'UPDATE_CUSTOMER', 'customer', req.params.id, req.body);
  res.json({ success: true, customer: result.rows[0] });
});

app.delete('/api/customers/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const result = await query('delete from customers where id=$1 returning *', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Customer not found' });
  await audit(req, 'DELETE_CUSTOMER', 'customer', req.params.id, {});
  res.json({ success: true, customer: result.rows[0] });
});

// Products
app.get('/api/products', requireAuth, async (_req, res) => {
  const result = await query('select * from products order by created_at desc');
  res.json({ success: true, products: result.rows });
});

app.post('/api/products', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { sku, name, category, price = 0, stock = 0, status = 'Active' } = req.body;
  const result = await query(
    `insert into products (sku, name, category, price, stock, status)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [sku, name, category, price, stock, status]
  );
  await audit(req, 'CREATE_PRODUCT', 'product', result.rows[0].id, req.body);
  res.status(201).json({ success: true, product: result.rows[0] });
});

// Orders
app.get('/api/orders', requireAuth, async (req, res) => {
  const onlyMine = req.query.mine === 'true' || req.user.role === 'user';
  const params = [];
  let where = '';
  if (onlyMine) {
    params.push(req.user.sub);
    where = 'where o.assigned_user_id=$1';
  }
  const result = await query(
    `select o.*, c.name as customer_name, p.name as product_name, u.name as assigned_user_name
     from orders o
     left join customers c on c.id=o.customer_id
     left join products p on p.id=o.product_id
     left join app_users u on u.id=o.assigned_user_id
     ${where}
     order by o.created_at desc`,
    params
  );
  res.json({ success: true, orders: result.rows });
});

app.post('/api/orders', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { order_no, customer_id, product_id, assigned_user_id, quantity = 1, amount = 0, status = 'New', priority = 'Normal' } = req.body;
  const result = await query(
    `insert into orders (order_no, customer_id, product_id, assigned_user_id, quantity, amount, status, priority)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [order_no, customer_id, product_id, assigned_user_id, quantity, amount, status, priority]
  );
  await audit(req, 'CREATE_ORDER', 'order', result.rows[0].id, req.body);
  res.status(201).json({ success: true, order: result.rows[0] });
});

app.put('/api/orders/:id/status', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { status } = req.body;
  const result = await query('update orders set status=$1, updated_at=now() where id=$2 returning *', [status, req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Order not found' });
  await audit(req, 'UPDATE_ORDER_STATUS', 'order', req.params.id, { status });
  res.json({ success: true, order: result.rows[0] });
});

app.get('/api/reports/sales', requireAuth, requireRole('admin', 'manager'), async (_req, res) => {
  const byStatus = await query('select status, count(*)::int as count, coalesce(sum(amount),0)::numeric(10,2) as revenue from orders group by status order by status');
  const byTier = await query('select c.tier, count(o.*)::int as orders, coalesce(sum(o.amount),0)::numeric(10,2) as revenue from customers c left join orders o on o.customer_id=c.id group by c.tier order by c.tier');
  res.json({ success: true, byStatus: byStatus.rows, byTier: byTier.rows });
});

// Automation utility endpoints
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  res.json({ success: true, file: req.file ? { originalname: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype } : null });
});

app.get('/api/delay', requireAuth, async (req, res) => {
  const ms = Math.min(Number(req.query.ms || 1000), 5000);
  await new Promise((resolve) => setTimeout(resolve, ms));
  res.json({ success: true, waitedMs: ms, message: 'Delayed API completed' });
});

app.get('/api/status/:code', requireAuth, (req, res) => {
  const code = Math.max(100, Math.min(Number(req.params.code), 599));
  res.status(code).json({ success: code < 400, status: code, message: `Simulated status ${code}` });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, error: 'API route not found' });
  res.status(404).sendFile(page('404.html'));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === '23505') return res.status(409).json({ success: false, error: 'Duplicate value violates a unique constraint' });
  if (error.code === '23502' || error.code === '23503' || error.code === '22P02') {
    return res.status(400).json({ success: false, error: 'Invalid or missing field value' });
  }
  res.status(500).json({ success: false, error: error.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Playwright Production Demo V3 running at http://localhost:${PORT}`);
});
