require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, query } = require('../src/db');
const fs = require('fs');
const path = require('path');

async function ensureSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

async function upsertUser({ name, email, password, role, department }) {
  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    `insert into app_users (name, email, password_hash, role, status, department)
     values ($1, $2, $3, $4, 'active', $5)
     on conflict (email) do update set
       name = excluded.name,
       password_hash = excluded.password_hash,
       role = excluded.role,
       status = 'active',
       department = excluded.department,
       updated_at = now()
     returning *`,
    [name, email, hash, role, department]
  );
  return result.rows[0];
}

async function main() {
  await ensureSchema();

  const admin = await upsertUser({ name: 'Admin User', email: 'admin@example.com', password: 'password123', role: 'admin', department: 'Platform Admin' });
  const manager = await upsertUser({ name: 'Manager User', email: 'manager@example.com', password: 'manager123', role: 'manager', department: 'Operations' });
  const user = await upsertUser({ name: 'Standard User', email: 'user@example.com', password: 'user123', role: 'user', department: 'Customer Success' });

  const customers = [
    ['CUST-1001', 'Ava Johnson', 'ava@example.com', 'Blue Harbor Hotels', 'Active', 'Platinum', admin.id],
    ['CUST-1002', 'Liam Smith', 'liam@example.com', 'Northstar Travel', 'Pending', 'Gold', manager.id],
    ['CUST-1003', 'Maya Patel', 'maya@example.com', 'Evergreen Retail', 'Active', 'Standard', user.id],
    ['CUST-1004', 'Noah Wilson', 'noah@example.com', 'Silverline Logistics', 'Inactive', 'Standard', manager.id],
    ['CUST-1005', 'Sophia Chen', 'sophia@example.com', 'Metro Cloud Services', 'Active', 'Gold', user.id]
  ];

  for (const c of customers) {
    await query(
      `insert into customers (customer_no, name, email, company, status, tier, owner_id)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (customer_no) do update set
         name=excluded.name,email=excluded.email,company=excluded.company,status=excluded.status,tier=excluded.tier,owner_id=excluded.owner_id,updated_at=now()`,
      c
    );
  }

  const products = [
    ['SKU-UI-001', 'Automation Starter Pack', 'Testing', 49.99, 120, 'Active'],
    ['SKU-API-002', 'API Validation Kit', 'Testing', 79.99, 75, 'Active'],
    ['SKU-AI-003', 'Agentic QA Bundle', 'AI', 149.99, 40, 'Active'],
    ['SKU-REP-004', 'Reporting Dashboard', 'Analytics', 99.99, 55, 'Draft']
  ];

  for (const p of products) {
    await query(
      `insert into products (sku, name, category, price, stock, status)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (sku) do update set
         name=excluded.name,category=excluded.category,price=excluded.price,stock=excluded.stock,status=excluded.status,updated_at=now()`,
      p
    );
  }

  const customerRows = (await query('select * from customers order by customer_no')).rows;
  const productRows = (await query('select * from products order by sku')).rows;

  const orders = [
    ['ORD-5001', customerRows[0].id, productRows[0].id, user.id, 2, 99.98, 'Processing', 'High'],
    ['ORD-5002', customerRows[1].id, productRows[1].id, manager.id, 1, 79.99, 'New', 'Normal'],
    ['ORD-5003', customerRows[2].id, productRows[2].id, user.id, 3, 449.97, 'Completed', 'Low'],
    ['ORD-5004', customerRows[4].id, productRows[0].id, user.id, 1, 49.99, 'Shipped', 'Normal']
  ];

  for (const o of orders) {
    await query(
      `insert into orders (order_no, customer_id, product_id, assigned_user_id, quantity, amount, status, priority)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (order_no) do update set
         customer_id=excluded.customer_id,product_id=excluded.product_id,assigned_user_id=excluded.assigned_user_id,
         quantity=excluded.quantity,amount=excluded.amount,status=excluded.status,priority=excluded.priority,updated_at=now()`,
      o
    );
  }

  await query(
    `insert into audit_logs (actor_email, actor_role, action, entity_type, details)
     values ($1, $2, 'SEED_DATABASE', 'system', $3)`,
    ['seed-script', 'system', { users: 3, customers: customers.length, products: products.length, orders: orders.length }]
  );

  console.log('Database seeded successfully.');
  console.log('Admin login: admin@example.com / password123');
  console.log('Manager login: manager@example.com / manager123');
  console.log('User login: user@example.com / user123');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
