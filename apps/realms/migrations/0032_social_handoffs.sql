-- The hold of a sign-in finished in another browser serves every provider now, not only Discord
-- (server/social-handoff.ts).
ALTER TABLE discord_handoffs RENAME TO social_handoffs;
