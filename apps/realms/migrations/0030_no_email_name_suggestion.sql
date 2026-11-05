-- New accounts no longer get a name suggested from their email's local part (server/auth.ts, assignRealmsIdentity):
-- the name shows on every leaderboard. An account that has not taken a name yet (its name is still its id) loses its
-- suggestion, and the app asks the player for a name instead of claiming it. That includes an account with a Discord
-- login: the Discord name is not stored, and an account made with an email code and linked to Discord later still holds
-- its email's suggestion, so no kept suggestion could be told from an email's. Named accounts are untouched.
update "user" set "suggestedName" = null where "name" = "id" and "suggestedName" is not null;
