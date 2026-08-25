CREATE TYPE note_visibility AS ENUM ('public', 'private');

CREATE TABLE notes (
  id VARCHAR(191) PRIMARY KEY,
  author_id VARCHAR(191) NOT NULL,
  zone_id VARCHAR(128) NOT NULL,
  title VARCHAR(120) NOT NULL,
  content VARCHAR(2000) NOT NULL,
  location JSONB NOT NULL DEFAULT '{}'::jsonb,
  visibility note_visibility NOT NULL DEFAULT 'public',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX notes_zone_created_idx ON notes (zone_id, created_at);
CREATE INDEX notes_author_created_idx ON notes (author_id, created_at);

CREATE TABLE world_chat_messages (
  id VARCHAR(191) PRIMARY KEY,
  zone_id VARCHAR(128),
  sender_id VARCHAR(191) NOT NULL,
  sender_wallet VARCHAR(68),
  sender_display_name VARCHAR(64),
  sender_avatar_url TEXT,
  content VARCHAR(2000) NOT NULL,
  location JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  moderated_at TIMESTAMPTZ
);

CREATE INDEX world_chat_zone_created_idx
  ON world_chat_messages (zone_id, created_at);
CREATE INDEX world_chat_sender_created_idx
  ON world_chat_messages (sender_id, created_at);

CREATE TABLE direct_message_threads (
  id VARCHAR(191) PRIMARY KEY,
  player_a_id VARCHAR(191) NOT NULL,
  player_b_id VARCHAR(191) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  last_message_id VARCHAR(191),
  last_message_at TIMESTAMPTZ,
  unread_counts JSONB,
  metadata JSONB,
  CONSTRAINT direct_message_players_unique UNIQUE (player_a_id, player_b_id)
);

CREATE TABLE direct_messages (
  id VARCHAR(191) PRIMARY KEY,
  thread_id VARCHAR(191) NOT NULL REFERENCES direct_message_threads(id) ON DELETE CASCADE,
  sender_id VARCHAR(191) NOT NULL,
  recipient_id VARCHAR(191) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX direct_messages_thread_created_idx
  ON direct_messages (thread_id, created_at);
CREATE INDEX direct_messages_sender_created_idx
  ON direct_messages (sender_id, created_at);

CREATE TABLE direct_message_read_receipts (
  thread_id VARCHAR(191) NOT NULL REFERENCES direct_message_threads(id) ON DELETE CASCADE,
  message_id VARCHAR(191) NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  reader_id VARCHAR(191) NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (thread_id, message_id, reader_id)
);

CREATE INDEX direct_message_read_receipts_thread_reader_idx
  ON direct_message_read_receipts (thread_id, reader_id);

CREATE TABLE direct_message_typing_states (
  thread_id VARCHAR(191) NOT NULL REFERENCES direct_message_threads(id) ON DELETE CASCADE,
  player_id VARCHAR(191) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (thread_id, player_id)
);

CREATE INDEX direct_message_typing_states_thread_idx
  ON direct_message_typing_states (thread_id);
