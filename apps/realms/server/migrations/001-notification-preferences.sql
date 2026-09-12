-- Apply to the identity database before deploying the preferences API. Does not enable device delivery.
BEGIN;
CREATE TABLE IF NOT EXISTS notification_preferences (
  owner text PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'off',
  revision integer NOT NULL DEFAULT 0,
  CONSTRAINT notification_level_valid CHECK (level IN ('off', 'important', 'standard', 'all')),
  CONSTRAINT notification_revision_valid CHECK (revision >= 0)
);
COMMIT;
