#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose -p madara-rand up -d --wait journal-primary journal-standby
docker compose -p madara-rand exec -T journal-primary psql -U postgres -d randomness -v ON_ERROR_STOP=1 \
    -c "ALTER SYSTEM SET synchronous_standby_names = 'FIRST 1 (journal_standby)'"
docker compose -p madara-rand exec -T journal-primary psql -U postgres -d randomness -v ON_ERROR_STOP=1 \
    -c 'SELECT pg_reload_conf()'
docker compose -p madara-rand exec -T journal-primary psql -U postgres -d randomness -v ON_ERROR_STOP=1 \
    -c "SELECT application_name, sync_state FROM pg_stat_replication"
echo 'local rehearsal, not the host-independence gate'
echo 'Initialize a NEW stream explicitly with: docker compose -p madara-rand exec -T journal-primary psql -U postgres -d randomness -v ON_ERROR_STOP=1 -f /schema.sql'
