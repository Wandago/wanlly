-- Wanlly Book: first schema. Times are stored as UTC ISO strings (YYYY-MM-DDTHH:MM:SSZ).

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- One-time sign-in links. Only a hash of the token is stored.
CREATE TABLE login_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX login_tokens_email ON login_tokens(email, created_at);

CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT 'other',
  tagline TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'KES',
  timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
  brand TEXT NOT NULL DEFAULT 'ink',
  slot_minutes INTEGER NOT NULL DEFAULT 30,
  notice_hours INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Who can manage a business, and with which role: owner, manager, staff, desk.
CREATE TABLE members (
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  PRIMARY KEY (business_id, user_id)
);

CREATE TABLE services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT '',
  duration_min INTEGER NOT NULL DEFAULT 60,
  price TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX services_business ON services(business_id, sort);

-- Opening hours: one row per open weekday (0 = Sunday). Minutes from midnight, local time.
CREATE TABLE hours (
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL,
  open_min INTEGER NOT NULL,
  close_min INTEGER NOT NULL,
  PRIMARY KEY (business_id, weekday)
);

-- How the business wants to be paid. Shown to customers; Wanlly Book never handles money.
CREATE TABLE payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  marketing_ok INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (business_id, email)
);

CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed, completed, cancelled, no_show
  notes TEXT NOT NULL DEFAULT '',
  manage_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX bookings_business_time ON bookings(business_id, starts_at);

-- Automatic emails per business: confirmation, reminder (hours before), followup (hours after).
CREATE TABLE email_settings (
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  offset_hours INTEGER NOT NULL DEFAULT 0,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (business_id, kind)
);

-- One row per email sent for a booking, so nothing is sent twice.
CREATE TABLE email_log (
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (booking_id, kind)
);
