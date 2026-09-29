-- The display name offered to a new player, from their Discord name or their email's local part.
alter table "user" add column "suggestedName" text;
