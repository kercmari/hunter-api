CREATE TABLE IF NOT EXISTS customers (
  phone       VARCHAR(20)  PRIMARY KEY,
  full_name   VARCHAR(200),
  tax_id      VARCHAR(30),
  email       VARCHAR(254),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_tax_id
  ON customers (tax_id) WHERE tax_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS contracts (
  id                  VARCHAR(20)   PRIMARY KEY,
  type                VARCHAR(12)   NOT NULL CHECK (type IN ('sale', 'renewal')),
  -- NUMERIC rather than a float: binary rounding on currency causes drift.
  amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  tax_id              VARCHAR(30)   NOT NULL,
  product_code        VARCHAR(20)   NOT NULL,
  full_name           VARCHAR(200)  NOT NULL,
  email               VARCHAR(254)  NOT NULL,
  phone               VARCHAR(20)   NOT NULL REFERENCES customers(phone),
  payment_status      VARCHAR(12)   NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN ('pending', 'confirmed', 'rejected')),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  payment_updated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contracts_phone  ON contracts (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts (payment_status) WHERE payment_status = 'pending';

-- Numbering lives in the database: an in-memory counter produces duplicate
-- identifiers as soon as a second instance runs.
CREATE SEQUENCE IF NOT EXISTS contracts_seq START 1;
CREATE SEQUENCE IF NOT EXISTS support_tickets_seq START 1;

CREATE TABLE IF NOT EXISTS support_tickets (
  id          VARCHAR(20)  PRIMARY KEY,
  phone       VARCHAR(20)  NOT NULL,
  reason      VARCHAR(200) NOT NULL,
  context     TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_phone ON support_tickets (phone, created_at DESC);

CREATE TABLE IF NOT EXISTS invoices (
  id           VARCHAR(20)  PRIMARY KEY,
  -- UNIQUE enforces one receipt per contract; reissuing returns the same one.
  contract_id  VARCHAR(20)  NOT NULL UNIQUE REFERENCES contracts(id) ON DELETE CASCADE,
  hash         CHAR(64)     NOT NULL,
  bytes        INTEGER      NOT NULL CHECK (bytes > 0),
  document     BYTEA        NOT NULL,
  issued_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  thread_id        VARCHAR(40)  PRIMARY KEY,
  contact_id       VARCHAR(40),
  phone            VARCHAR(20),
  last_message_id  VARCHAR(64),
  resolved_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_phone
  ON conversations (phone, resolved_at DESC) WHERE phone IS NOT NULL;

-- Webhook idempotency. The primary key settles the race when concurrent
-- retries reach different instances.
CREATE TABLE IF NOT EXISTS processed_messages (
  message_id    VARCHAR(64)  PRIMARY KEY,
  processed_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processed_messages_date ON processed_messages (processed_at);
