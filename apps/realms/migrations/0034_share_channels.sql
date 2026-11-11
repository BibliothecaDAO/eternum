-- Where the link a visit came through was posted from (`?via=`: "x", "system"; null when the link named none), so the
-- operator's report can tell what each way of posting brings (server/shares.ts).
alter table "share_visits" add column "via" text;
