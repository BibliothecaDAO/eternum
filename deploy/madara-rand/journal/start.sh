#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if state=$(docker inspect --format '{{.State.Running}} {{len .NetworkSettings.Networks}}' madara-rand-journal-primary-1 2>/dev/null); then
    if [ "$state" = 'false 0' ]; then
        echo 'The former primary is fenced. Use the recorded promotion topology; do not restart the stale disk.' >&2
        exit 1
    fi
fi
docker compose -p madara-rand up -d --wait journal-primary journal-standby
docker compose -p madara-rand exec -T journal-primary psql -U postgres -d randomness -v ON_ERROR_STOP=1 \
    -c "ALTER SYSTEM SET synchronous_standby_names = 'FIRST 1 (journal_standby)'"
docker compose -p madara-rand exec -T journal-primary psql -U postgres -d randomness -v ON_ERROR_STOP=1 \
    -c 'SELECT pg_reload_conf()'
docker compose -p madara-rand exec -T journal-primary psql -U postgres -d randomness -v ON_ERROR_STOP=1 \
    -c "SELECT application_name, sync_state FROM pg_stat_replication"
echo 'local rehearsal, not the host-independence gate'
echo 'Initialize a NEW stream explicitly with: docker compose -p madara-rand exec -T journal-primary psql -U postgres -d randomness -v ON_ERROR_STOP=1 -f /schema.sql -f /lookup.sql'
