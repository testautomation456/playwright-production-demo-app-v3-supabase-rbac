const tokenKey = 'rbacDemoToken';
const userKey = 'rbacDemoUser';

function getToken() { return localStorage.getItem(tokenKey); }
function getUser() { try { return JSON.parse(localStorage.getItem(userKey) || 'null'); } catch { return null; } }
function setSession(token, user) { localStorage.setItem(tokenKey, token); localStorage.setItem(userKey, JSON.stringify(user)); }
function clearSession() { localStorage.removeItem(tokenKey); localStorage.removeItem(userKey); }

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { ...options, headers });
  let data;
  try { data = await response.json(); } catch { data = { success: false, error: response.statusText }; }
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function toast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('data-testid', 'toast');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function badge(value) {
  const v = String(value || '');
  const cls = ['Active','Completed','Shipped','success'].includes(v) ? 'ok' : ['Pending','New','Processing','Draft','High'].includes(v) ? 'warn' : ['Inactive','Cancelled','disabled'].includes(v) ? 'danger' : '';
  return `<span class="badge ${cls}">${escapeHtml(v)}</span>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function requirePageAuth(requiredRoles = []) {
  const token = getToken();
  const user = getUser();
  if (!token || !user) {
    location.href = '/login';
    return null;
  }
  document.body.classList.add(`role-${user.role}`);
  const nameEl = document.querySelector('[data-user-name]');
  const roleEl = document.querySelector('[data-user-role]');
  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = `${user.email} • ${user.role}`;
  document.querySelectorAll('[data-current-role]').forEach(el => el.textContent = user.role);
  if (requiredRoles.length && !requiredRoles.includes(user.role)) {
    const main = document.querySelector('main') || document.body;
    main.innerHTML = `<div class="card"><h1>Access denied</h1><p class="hint">This page requires role: ${requiredRoles.join(' or ')}. Your role is ${user.role}.</p><a class="btn" href="/dashboard">Back to dashboard</a></div>`;
  }
  return user;
}

function wireLogout() {
  document.querySelectorAll('[data-logout]').forEach(btn => btn.addEventListener('click', () => { clearSession(); location.href = '/login'; }));
}

function activateNav() {
  const path = location.pathname;
  document.querySelectorAll('.nav a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
}

function renderShell(activePath = '') {
  const user = getUser();
  const nav = document.querySelector('[data-nav]');
  if (!nav || !user) return;
  document.body.classList.add(`role-${user.role}`);
  nav.innerHTML = `
    <a href="/dashboard">🏠 Dashboard</a>
    <a class="admin-only" href="/admin">🛡️ Admin Console</a>
    <a href="/users">👤 User Portal</a>
    <a class="manager-only" href="/customers">🏢 Customers</a>
    <a class="manager-only" href="/orders">📦 Orders</a>
    <a class="manager-only" href="/products">🧾 Products</a>
    <a class="manager-only" href="/reports">📊 Reports</a>
    <a href="/components">🧩 UI Components</a>
    <a href="/iframe-lab">🪟 Iframe Lab</a>
    <a href="/api-explorer">🔌 API Explorer</a>
    <a href="/settings">⚙️ Settings</a>
    <button data-logout>↩ Logout</button>
  `;
  if (activePath) document.querySelectorAll(`.nav a[href="${activePath}"]`).forEach(a => a.classList.add('active'));
  wireLogout();
}

function formatCurrency(value) { return `$${Number(value || 0).toFixed(2)}`; }
function fmtDate(value) { return value ? new Date(value).toLocaleString() : ''; }

async function pageLogin() {
  if (getToken()) location.href = '/dashboard';
  const form = document.querySelector('[data-login-form]');
  const err = document.querySelector('[data-login-error]');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    const body = {
      username: form.username.value.trim(),
      password: form.password.value
    };
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
      setSession(data.token, data.user);
      location.href = '/dashboard';
    } catch (error) {
      err.textContent = error.message;
    }
  });
}

async function pageDashboard() {
  const user = requirePageAuth(); if (!user) return; renderShell('/dashboard');
  try {
    const data = await api('/api/dashboard');
    document.querySelector('[data-metric-customers]').textContent = data.metrics.customers;
    document.querySelector('[data-metric-orders]').textContent = data.metrics.orders;
    document.querySelector('[data-metric-revenue]').textContent = formatCurrency(data.metrics.revenue);
    document.querySelector('[data-metric-users]').textContent = data.metrics.users;
    document.querySelector('[data-dashboard-role]').textContent = user.role;
  } catch (error) { toast(error.message); }
}

async function pageAdmin() {
  const user = requirePageAuth(['admin']); if (!user) return; renderShell('/admin');
  const tbody = document.querySelector('[data-users-body]');
  const audit = document.querySelector('[data-audit-body]');
  const form = document.querySelector('[data-create-user-form]');

  async function loadUsers() {
    const data = await api('/api/admin/users');
    tbody.innerHTML = data.users.map(u => `
      <tr data-user-row="${u.email}">
        <td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td>${badge(u.role)}</td><td>${badge(u.status)}</td><td>${escapeHtml(u.department)}</td>
        <td class="actions">
          ${u.status === 'disabled'
            ? `<button class="btn small secondary" data-enable-user="${u.id}">Enable</button>`
            : `<button class="btn small secondary" data-disable-user="${u.id}">Disable</button>`}
        </td>
      </tr>`).join('');
    document.querySelectorAll('[data-disable-user]').forEach(btn => btn.addEventListener('click', async () => {
      await api(`/api/admin/users/${btn.dataset.disableUser}`, { method: 'DELETE' });
      toast('User disabled');
      loadUsers(); loadAudit();
    }));
    document.querySelectorAll('[data-enable-user]').forEach(btn => btn.addEventListener('click', async () => {
      await api(`/api/admin/users/${btn.dataset.enableUser}`, { method: 'PUT', body: JSON.stringify({ status: 'active' }) });
      toast('User enabled');
      loadUsers(); loadAudit();
    }));
  }

  async function loadAudit() {
    const data = await api('/api/admin/audit');
    audit.innerHTML = data.audit.map(a => `<tr><td>${fmtDate(a.created_at)}</td><td>${escapeHtml(a.actor_email)}</td><td>${escapeHtml(a.action)}</td><td>${escapeHtml(a.entity_type)}</td></tr>`).join('');
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form).entries());
    await api('/api/admin/users', { method: 'POST', body: JSON.stringify(body) });
    form.reset(); toast('User created'); loadUsers(); loadAudit();
  });

  loadUsers(); loadAudit();
}

async function pageUsers() {
  const user = requirePageAuth(); if (!user) return; renderShell('/users');
  const profile = document.querySelector('[data-profile]');
  const orders = document.querySelector('[data-my-orders-body]');
  const form = document.querySelector('[data-profile-form]');
  async function load() {
    const data = await api('/api/user/profile');
    profile.innerHTML = `<h3>${escapeHtml(data.profile.name)}</h3><p class="hint">${escapeHtml(data.profile.email)} • ${escapeHtml(data.profile.role)} • ${escapeHtml(data.profile.department)}</p>`;
    form.name.value = data.profile.name; form.department.value = data.profile.department || '';
    const my = await api('/api/user/orders');
    orders.innerHTML = my.orders.map(o => `<tr><td>${escapeHtml(o.order_no)}</td><td>${escapeHtml(o.customer_name)}</td><td>${escapeHtml(o.product_name)}</td><td>${badge(o.status)}</td><td>${formatCurrency(o.amount)}</td></tr>`).join('');
  }
  form.addEventListener('submit', async e => { e.preventDefault(); await api('/api/user/profile', { method: 'PUT', body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) }); toast('Profile updated'); load(); });
  load();
}

async function pageCustomers() {
  const user = requirePageAuth(['admin','manager']); if (!user) return; renderShell('/customers');
  const tbody = document.querySelector('[data-customers-body]');
  const search = document.querySelector('[data-search]');
  const form = document.querySelector('[data-customer-form]');
  async function load() {
    const data = await api(`/api/customers?search=${encodeURIComponent(search.value)}`);
    tbody.innerHTML = data.customers.map(c => `
      <tr data-customer-row="${c.customer_no}"><td>${escapeHtml(c.customer_no)}</td><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.company)}</td><td>${badge(c.status)}</td><td>${badge(c.tier)}</td><td>${escapeHtml(c.owner_name)}</td><td class="actions"><button class="btn small secondary" data-edit-customer="${c.id}">Mark Pending</button>${user.role==='admin'?`<button class="btn small danger" data-delete-customer="${c.id}">Delete</button>`:''}</td></tr>`).join('');
    document.querySelectorAll('[data-edit-customer]').forEach(btn => btn.addEventListener('click', async () => { await api(`/api/customers/${btn.dataset.editCustomer}`, { method:'PUT', body: JSON.stringify({ status: 'Pending' }) }); toast('Customer updated'); load(); }));
    document.querySelectorAll('[data-delete-customer]').forEach(btn => btn.addEventListener('click', async () => { await api(`/api/customers/${btn.dataset.deleteCustomer}`, { method:'DELETE' }); toast('Customer deleted'); load(); }));
  }
  search.addEventListener('input', () => load());
  form.addEventListener('submit', async e => { e.preventDefault(); const body = Object.fromEntries(new FormData(form).entries()); await api('/api/customers', { method:'POST', body: JSON.stringify(body) }); form.reset(); toast('Customer created'); load(); });
  load();
}

async function pageProducts() {
  const user = requirePageAuth(['admin','manager']); if (!user) return; renderShell('/products');
  const tbody = document.querySelector('[data-products-body]');
  const form = document.querySelector('[data-product-form]');
  async function load() {
    const data = await api('/api/products');
    tbody.innerHTML = data.products.map(p => `<tr><td>${escapeHtml(p.sku)}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category)}</td><td>${formatCurrency(p.price)}</td><td>${p.stock}</td><td>${badge(p.status)}</td></tr>`).join('');
  }
  form.addEventListener('submit', async e => { e.preventDefault(); await api('/api/products', { method:'POST', body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) }); form.reset(); toast('Product created'); load(); });
  load();
}

async function pageOrders() {
  const user = requirePageAuth(['admin','manager']); if (!user) return; renderShell('/orders');
  const tbody = document.querySelector('[data-orders-body]');
  const form = document.querySelector('[data-order-form]');
  const selects = ['customer_id','product_id','assigned_user_id'];
  async function hydrateSelects() {
    const [customers, products, users] = await Promise.all([api('/api/customers'), api('/api/products'), api('/api/admin/users').catch(() => ({ users: [] }))]);
    form.customer_id.innerHTML = customers.customers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    form.product_id.innerHTML = products.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    form.assigned_user_id.innerHTML = users.users.map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${u.role})</option>`).join('');
  }
  async function load() {
    const data = await api('/api/orders');
    tbody.innerHTML = data.orders.map(o => `<tr><td>${escapeHtml(o.order_no)}</td><td>${escapeHtml(o.customer_name)}</td><td>${escapeHtml(o.product_name)}</td><td>${escapeHtml(o.assigned_user_name)}</td><td>${badge(o.status)}</td><td>${badge(o.priority)}</td><td>${formatCurrency(o.amount)}</td><td><button class="btn small secondary" data-ship-order="${o.id}">Ship</button></td></tr>`).join('');
    document.querySelectorAll('[data-ship-order]').forEach(btn => btn.addEventListener('click', async () => { await api(`/api/orders/${btn.dataset.shipOrder}/status`, { method:'PUT', body: JSON.stringify({ status:'Shipped' }) }); toast('Order shipped'); load(); }));
  }
  form.addEventListener('submit', async e => { e.preventDefault(); await api('/api/orders', { method:'POST', body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) }); form.reset(); await hydrateSelects(); toast('Order created'); load(); });
  await hydrateSelects(); load();
}

async function pageReports() {
  const user = requirePageAuth(['admin','manager']); if (!user) return; renderShell('/reports');
  const data = await api('/api/reports/sales');
  document.querySelector('[data-report-status]').innerHTML = data.byStatus.map(x => `<tr><td>${badge(x.status)}</td><td>${x.count}</td><td>${formatCurrency(x.revenue)}</td></tr>`).join('');
  document.querySelector('[data-report-tier]').innerHTML = data.byTier.map(x => `<tr><td>${badge(x.tier)}</td><td>${x.orders}</td><td>${formatCurrency(x.revenue)}</td></tr>`).join('');
}

async function pageComponents() {
  const user = requirePageAuth(); if (!user) return; renderShell('/components');
  document.querySelector('[data-open-modal]').addEventListener('click', () => document.querySelector('[data-modal]').hidden = false);
  document.querySelector('[data-close-modal]').addEventListener('click', () => document.querySelector('[data-modal]').hidden = true);
  document.querySelector('[data-save-modal]').addEventListener('click', () => { document.querySelector('[data-modal]').hidden = true; toast('Modal saved successfully'); });
  document.querySelector('[data-toast]').addEventListener('click', () => toast('This is a dynamic toast message'));
  document.querySelector('[data-alert]').addEventListener('click', () => alert('Automation alert message'));
  document.querySelector('[data-confirm]').addEventListener('click', () => toast(confirm('Do you confirm this action?') ? 'Confirmed' : 'Cancelled'));
  document.querySelector('[data-prompt]').addEventListener('click', () => toast(`Prompt value: ${prompt('Enter test value') || ''}`));
  document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => { document.querySelector('[data-tab-panel]').textContent = `Loaded tab: ${btn.dataset.tab}`; }));
  document.querySelectorAll('[data-accordion]').forEach(btn => btn.addEventListener('click', () => { const target = document.querySelector(`#${btn.dataset.accordion}`); target.hidden = !target.hidden; }));
  document.querySelector('[data-load-dynamic]').addEventListener('click', async () => { const box = document.querySelector('[data-dynamic-box]'); box.textContent = 'Loading...'; await new Promise(r => setTimeout(r, 900)); box.innerHTML = `<strong data-testid="dynamic-result">Dynamic content loaded at ${new Date().toLocaleTimeString()}</strong>`; });
  const drag = document.querySelector('[data-draggable]'); const drop = document.querySelector('[data-drop-zone]');
  drag.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', 'automation-card'));
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('active'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('active'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('active'); drop.textContent = `Dropped: ${e.dataTransfer.getData('text/plain')}`; });
}

async function pageIframeLab() { const user = requirePageAuth(); if (!user) return; renderShell('/iframe-lab'); }

async function pageApiExplorer() {
  const user = requirePageAuth(); if (!user) return; renderShell('/api-explorer');
  const method = document.querySelector('[data-api-method]');
  const path = document.querySelector('[data-api-path]');
  const body = document.querySelector('[data-api-body]');
  const output = document.querySelector('[data-api-output]');
  document.querySelector('[data-api-send]').addEventListener('click', async () => {
    output.textContent = 'Calling API...';
    try {
      const opts = { method: method.value };
      if (!['GET','DELETE'].includes(method.value)) opts.body = body.value || '{}';
      const data = await api(path.value, opts);
      output.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      output.textContent = JSON.stringify(error.data || { error: error.message }, null, 2);
    }
  });
}

async function pageSettings() {
  const user = requirePageAuth(); if (!user) return; renderShell('/settings');
  document.querySelector('[data-role-text]').textContent = user.role;
  document.querySelector('[data-test-upload]').addEventListener('change', e => {
    document.querySelector('[data-upload-name]').textContent = e.target.files[0]?.name || 'No file selected';
  });
  document.querySelector('[data-upload-form]').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = await api('/api/upload', { method:'POST', body: fd, headers: {} });
    toast(`Uploaded: ${data.file?.originalname || 'none'}`);
  });
}

customElements.define('qa-status-card', class extends HTMLElement {
  connectedCallback() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>.box{border:1px solid #6c8cff;border-radius:14px;padding:16px;background:#111;color:white;font-family:Arial}.ok{color:#51e08c}</style><div class="box"><strong>Shadow DOM Widget</strong><p class="ok" data-testid="shadow-status">Healthy</p><button data-testid="shadow-button">Shadow Action</button></div>`;
  }
});

window.DemoApp = { pageLogin, pageDashboard, pageAdmin, pageUsers, pageCustomers, pageOrders, pageProducts, pageReports, pageComponents, pageIframeLab, pageApiExplorer, pageSettings, api, toast, requirePageAuth, renderShell };
