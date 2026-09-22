-- better-auth's tables for Sign in with Starknet, passkeys and anonymous sign-up, as its own schema generator emits
-- them for SQLite, plus the Realms id.
create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null, "address" text unique, "isAnonymous" integer, "realmsId" text unique);

create table "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);

create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);

create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);

create table "passkey" ("id" text not null primary key, "name" text, "publicKey" text not null, "userId" text not null references "user" ("id") on delete cascade, "credentialID" text not null, "counter" integer not null, "deviceType" text not null, "backedUp" integer not null, "transports" text, "createdAt" date, "aaguid" text);

create index "session_userId_idx" on "session" ("userId");

create index "account_userId_idx" on "account" ("userId");

create index "verification_identifier_idx" on "verification" ("identifier");

create index "passkey_userId_idx" on "passkey" ("userId");

create index "passkey_credentialID_idx" on "passkey" ("credentialID");

-- Display names are unique case-insensitively; the index is the race-proof truth.
create unique index "user_name_lower_unique" on "user" (lower("name"));

-- Notification settings belong to the Realms account, named by its Realms id. Times are Unix milliseconds.
create table "notification_preferences" (
  "owner" text not null primary key references "user" ("realmsId") on delete cascade,
  "level" text not null default 'off' check ("level" in ('off', 'important', 'standard', 'all')),
  "revision" integer not null default 0 check ("revision" >= 0)
);

create table "notification_push_subscriptions" (
  "id" text not null primary key,
  "owner" text not null references "user" ("realmsId") on delete cascade,
  "endpoint" text not null unique,
  "p256dh" text not null,
  "auth" text not null,
  "revocationHash" text not null,
  "gameAlertsSource" text,
  "gameAlertsEnabledAt" integer,
  "directMessagesEnabledAt" integer,
  "gameForegroundUntil" integer,
  "createdAt" integer not null
);

create index "notification_push_owner_idx" on "notification_push_subscriptions" ("owner");
