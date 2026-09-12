-- DhanSathi schema (ADR-032).
--
-- Run against a Supabase (or any) Postgres:
--   npm run db:migrate
--
-- Design notes that matter for the review:
--  * consent_records and audit_records are APPEND-ONLY. Consent is a ledger of
--    changes over time, not a mutable row, because "what did this customer
--    consent to on the day we made that decision?" is the question a regulator
--    actually asks.
--  * audit_records carries the hash chain. seq is assigned by the database so
--    the ordering cannot be rewritten by a racing client.
--  * loan_offers stores the Key Facts Statement as issued, not a template id.
--    The KFS the customer saw is the document we must be able to produce later,
--    even if our rates or fees change afterwards.

CREATE TABLE IF NOT EXISTS customers (
  customer_id        TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  segment            TEXT NOT NULL CHECK (segment IN ('salaried', 'gig', 'self_employed')),
  city_tier          SMALLINT NOT NULL CHECK (city_tier BETWEEN 1 AND 4),
  preferred_language TEXT NOT NULL DEFAULT 'en',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  txn_id      TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  ts          TIMESTAMPTZ NOT NULL,
  amount      NUMERIC(14, 2) NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  category    TEXT NOT NULL,
  merchant    TEXT,
  mode        TEXT NOT NULL
);

-- Signals are always computed over one customer's history in date order.
CREATE INDEX IF NOT EXISTS transactions_customer_ts_idx
  ON transactions (customer_id, ts);

-- Append-only consent ledger. The current state is the latest row per scope.
CREATE TABLE IF NOT EXISTS consent_records (
  id          BIGSERIAL PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  scope       TEXT NOT NULL CHECK (scope IN ('transactions', 'location', 'spendCategories')),
  granted     BOOLEAN NOT NULL,
  purpose     TEXT NOT NULL,
  actor       TEXT NOT NULL DEFAULT 'customer',
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_records_customer_idx
  ON consent_records (customer_id, scope, changed_at DESC);

-- Tamper-evident decision log. seq is database-assigned; hash chains on prev_hash.
CREATE TABLE IF NOT EXISTS audit_records (
  seq              BIGSERIAL PRIMARY KEY,
  customer_id      TEXT NOT NULL,
  action           TEXT NOT NULL,
  data_accessed    TEXT[] NOT NULL DEFAULT '{}',
  consent_verified BOOLEAN NOT NULL,
  decision         TEXT NOT NULL,
  reason_trace     TEXT[] NOT NULL DEFAULT '{}',
  prev_hash        TEXT NOT NULL,
  hash             TEXT NOT NULL UNIQUE,
  occurred_at      TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_records_customer_idx
  ON audit_records (customer_id, seq DESC);

-- A loan offer, with the Key Facts Statement exactly as the customer saw it.
CREATE TABLE IF NOT EXISTS loan_offers (
  proposal_no        TEXT PRIMARY KEY,
  customer_id        TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  product            TEXT NOT NULL,
  principal          NUMERIC(14, 2) NOT NULL,
  tenor_months       SMALLINT NOT NULL,
  nominal_rate       NUMERIC(6, 3) NOT NULL,
  apr                NUMERIC(6, 3) NOT NULL,
  kfs                JSONB NOT NULL,
  status             TEXT NOT NULL DEFAULT 'issued'
                       CHECK (status IN ('issued', 'accepted', 'cancelled', 'expired')),
  issued_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  kfs_valid_until    TIMESTAMPTZ NOT NULL,
  accepted_at        TIMESTAMPTZ,
  cooling_off_ends_at TIMESTAMPTZ,
  cancelled_at       TIMESTAMPTZ,
  cancellation_amount NUMERIC(14, 2)
);

CREATE INDEX IF NOT EXISTS loan_offers_customer_idx
  ON loan_offers (customer_id, issued_at DESC);
