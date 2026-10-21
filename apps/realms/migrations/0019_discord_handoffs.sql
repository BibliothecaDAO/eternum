-- A Discord sign-in finished in another browser than the one that started it, held for the starting browser behind a
-- one-time code (server/discord-handoff.ts). Each claim is one statement: a right code takes the row, a wrong one counts.
CREATE TABLE discord_handoffs (
  state TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  cookies TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
