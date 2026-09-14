#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username postgres --dbname randomness <<'SQL'
CREATE ROLE randomness_writer_1 LOGIN PASSWORD 'local-rehearsal';
CREATE ROLE replicator LOGIN REPLICATION PASSWORD 'local-rehearsal';
SQL
printf '%s\n' 'host replication replicator all scram-sha-256' >> "$PGDATA/pg_hba.conf"
