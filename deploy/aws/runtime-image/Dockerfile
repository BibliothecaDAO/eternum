ARG DOJO_VERSION=v1.8.16
ARG LIBMDBX_VERSION=v0.13.12

FROM ghcr.io/dojoengine/dojo:${DOJO_VERSION} AS dojo

FROM debian:bookworm-slim AS mdbx-builder
ARG LIBMDBX_VERSION

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash build-essential ca-certificates git make \
  && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch "${LIBMDBX_VERSION}" https://github.com/erthink/libmdbx.git /tmp/libmdbx \
  && make -C /tmp/libmdbx mdbx_copy \
  && install -m 0755 /tmp/libmdbx/mdbx_copy /usr/local/bin/mdbx_copy

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl sqlite3 zstd \
  && rm -rf /var/lib/apt/lists/*

COPY --from=dojo /usr/local/bin/katana /usr/local/bin/katana
COPY --from=dojo /usr/local/bin/torii /usr/local/bin/torii
COPY --from=mdbx-builder /usr/local/bin/mdbx_copy /usr/local/bin/mdbx_copy
COPY entrypoint.sh /usr/local/bin/runtime-entrypoint.sh
COPY healthcheck.sh /usr/local/bin/healthcheck.sh
COPY path-proxy.mjs /usr/local/bin/path-proxy.mjs
COPY render-torii-config.mjs /usr/local/bin/render-torii-config.mjs
COPY runtime-snapshot.mjs /usr/local/bin/runtime-snapshot.mjs

RUN chmod +x /usr/local/bin/runtime-entrypoint.sh /usr/local/bin/healthcheck.sh

ENV DATA_DIR=/data
ENV SNAPSHOT_DIR=/snapshots
ENV SNAPSHOT_INTERVAL_SECONDS=300
ENV SNAPSHOT_RETAIN=3
ENV PUBLIC_PORT=8080
ENV INTERNAL_PORT=8081

EXPOSE 5050 8080

ENTRYPOINT ["/usr/local/bin/runtime-entrypoint.sh"]
