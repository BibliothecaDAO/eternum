-- 0030 as first merged spared every account with a Discord login, and staging ran that version: an account made with an
-- email code and linked to Discord later kept its email's suggestion, which the app would claim as its public name.
-- 0030 was then corrected in place, which a database that already recorded it never runs again. This is the correction
-- for those databases: the Discord name is not stored, so no kept suggestion can be told from an email's, and every
-- account that has not taken a name yet (its name is still its id) loses its suggestion. Where the corrected 0030 ran,
-- nothing is left for it to change. Named accounts are untouched.
update "user" set "suggestedName" = null where "name" = "id" and "suggestedName" is not null;
