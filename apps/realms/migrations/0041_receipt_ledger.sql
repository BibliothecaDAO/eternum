-- The receipt ledger records every verified payment once, with who sent it and what came of it, so a retry is answered
-- from the record and a payment that could not be honoured is there to refund. Deleting an account clears its "owner"
-- here and keeps the row, so its receipts stay spent.
alter table "store_receipts" add column "owner" text;
alter table "store_receipts" add column "outcome" text not null default 'fragments';

update "store_receipts" set "outcome" = 'seal' where "product" in ('seal', 'seal-holder');
update "store_receipts" set "owner" = coalesce(
  (select "owner" from "seal" where "seal"."receipt" = "store_receipts"."receipt"),
  (select "owner" from "fragment_credits" where "fragment_credits"."receipt" = "store_receipts"."receipt")
);
