#!/bin/sh
set -eu
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    if [ -n "$(ls -A "$PGDATA")" ]; then
        echo 'Incomplete standby volume; inspect before restoring.' >&2
        exit 1
    fi
    chown postgres:postgres "$PGDATA"
    chmod 700 "$PGDATA"
    gosu postgres pg_basebackup -D "$PGDATA" -R -X stream --checkpoint=fast \
        -d "host=${JOURNAL_UPSTREAM:?Set the verified primary} user=replicator password=local-rehearsal application_name=journal_standby"
fi
exec gosu postgres postgres -D "$PGDATA" -c fsync=on -c full_page_writes=on \
    -c synchronous_commit=remote_apply -c 'synchronous_standby_names=FIRST 1 (journal_standby)'
