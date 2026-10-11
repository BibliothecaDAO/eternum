DROP INDEX wallet_link_history_account_time;
ALTER TABLE wallet_link_history DROP COLUMN ready_at;
ALTER TABLE pay_decisions DROP COLUMN evidence_time;
