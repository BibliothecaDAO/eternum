-- The identity Worker reads the rating population from the chain, so nothing reads the MMR indexer's rows. Drops its
-- table and the indexer's cursor and rollback rows in Apibara's schema. Safe to run twice, and on a database where the
-- indexer never ran.
DROP TABLE IF EXISTS starknet_mmr_updates;
DO $$
DECLARE
  indexer CONSTANT text := 'indexer_strk_mmr_updates_starknet_mmr_updates';
BEGIN
  IF to_regclass('airfoil.checkpoints') IS NOT NULL THEN
    DELETE FROM airfoil.checkpoints WHERE id = indexer;
  END IF;
  IF to_regclass('airfoil.filters') IS NOT NULL THEN
    DELETE FROM airfoil.filters WHERE id = indexer;
  END IF;
  IF to_regclass('airfoil.reorg_rollback') IS NOT NULL THEN
    DELETE FROM airfoil.reorg_rollback WHERE indexer_id = indexer;
  END IF;
  IF to_regclass('airfoil.chain_reorganizations') IS NOT NULL THEN
    DELETE FROM airfoil.chain_reorganizations WHERE indexer_id = indexer;
  END IF;
END $$;
