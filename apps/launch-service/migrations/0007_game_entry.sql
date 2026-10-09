ALTER TABLE launch_runs ADD COLUMN entry TEXT;
-- Earlier completed launches were free; incomplete paid launches remain unavailable until their ledger opening.
UPDATE launch_runs SET entry='{"kind":"free"}'
 WHERE kind='game' AND (status='complete' OR environment<>'madara.blitz');
