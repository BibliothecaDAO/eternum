-- A second paid Ancient Seal is recorded for refund, not as a repeat of the first: its outcome says so.
update "store_receipts" set "outcome" = 'unfulfilled_seal_held' where "outcome" = 'seal_held';
