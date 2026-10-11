-- An earlier 0007 may already have declared legacy Blitz rows free without opening provenance.
-- Withdraw that assumption on upgrade too; exact opening terms must be restored before serving the game.
UPDATE launch_runs SET entry=NULL
 WHERE kind='game' AND environment='madara.blitz' AND entry='{"kind":"free"}';
