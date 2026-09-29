CREATE TABLE sign_in_budget (
  email TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sign_in_budget_expiry ON sign_in_budget(expires_at);
