-- New accounts no longer get a name suggested from their email's local part (server/auth.ts, assignRealmsIdentity):
-- the name shows on every leaderboard. An account that has not taken a name yet (its name is still its id) loses such a
-- suggestion, so the app asks the player for a name instead of claiming it. A Discord account keeps its Discord name.
-- Named accounts are untouched.
update "user" set "suggestedName" = null
where "name" = "id"
  and "suggestedName" is not null
  and not exists (select 1 from "account" a where a."userId" = "user"."id" and a."providerId" = 'discord');
