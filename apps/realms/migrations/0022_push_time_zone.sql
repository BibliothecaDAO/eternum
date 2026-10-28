-- The phone's own time zone, reported each time the game is open: quiet hours and the times a push names are its own.
alter table "notification_push_subscriptions" add column "timeZone" text;
