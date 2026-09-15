BEGIN;
        DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='randomness_writer_2') THEN
          CREATE ROLE randomness_writer_2 LOGIN PASSWORD 'local-rehearsal'; END IF; END $$;
        GRANT USAGE ON SCHEMA randomness TO randomness_writer_2;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA randomness TO randomness_writer_2;
        UPDATE randomness.stream SET epoch=2,writer='randomness_writer_2' WHERE epoch=1;
        REVOKE ALL ON SCHEMA randomness FROM randomness_writer_1;
        REVOKE ALL ON ALL FUNCTIONS IN SCHEMA randomness FROM randomness_writer_1;
        COMMIT;
