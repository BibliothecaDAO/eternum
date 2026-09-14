#!/bin/sh
set -eu
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    if [ -n "$(ls -A "$PGDATA")" ]; then
        echo 'Incomplete standby volume; inspect before restoring.' >&2
        exit 1
    fi
    chown postgres:postgres "$PGDATA"
    chmod 700 "$PGDATA"
    gosu postgres pg_basebackup -D "$PGDATA" -R -X stream \
        -d 'host=journal-primary user=replicator password=local-rehearsal application_name=journal_standby'
fi
exec gosu postgres postgres -D "$PGDATA"
