ALTER TABLE launch_runs ADD COLUMN entry TEXT;
-- Frontier/Eternum were free. A legacy Blitz row has no trustworthy entry provenance, even when complete.
UPDATE launch_runs SET entry='{"kind":"free"}'
 WHERE kind='game' AND environment<>'madara.blitz';
