-- Settings offers Off, Important and All. An account still on the old Standard level moves to All, which carries every
-- alert Standard did, so nobody loses one they had.
update "notification_preferences" set "level" = 'all' where "level" = 'standard';
