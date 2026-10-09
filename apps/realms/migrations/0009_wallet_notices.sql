-- A wallet change and its security notice are committed together; delivery retries from the existing cron.
CREATE TABLE wallet_change_notices (id TEXT PRIMARY KEY, email TEXT NOT NULL, address TEXT);
