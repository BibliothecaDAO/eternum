ARG DOJO_VERSION=v1.8.16
ARG TORII_IMAGE_DIGEST=sha256:4f6633c1f8fddbc68d647e14f424c91f083c20d14a5dd4661eb0ab77841899ac
ARG KATANA_VERSION=v1.7.1
ARG KATANA_ARCHIVE_SHA256=34632a9640b4572fb46a227deb645334addf1ca88431613da47ea8e7c70992e1
ARG LIBMDBX_COMMIT=5315e9905b525a0a183b76fc787317c51076f944

FROM ghcr.io/dojoengine/torii:${DOJO_VERSION}@${TORII_IMAGE_DIGEST} AS torii

FROM debian:bookworm-slim@sha256:60eac759739651111db372c07be67863818726f754804b8707c90979bda511df AS mdbx-builder
ARG LIBMDBX_COMMIT
ARG KATANA_VERSION
ARG KATANA_ARCHIVE_SHA256

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash build-essential ca-certificates curl git make \
  && rm -rf /var/lib/apt/lists/*

RUN git init /tmp/libmdbx \
  && git -C /tmp/libmdbx remote add origin https://github.com/erthink/libmdbx.git \
  && git -C /tmp/libmdbx fetch --depth 1 origin "${LIBMDBX_COMMIT}" \
  && test "$(git -C /tmp/libmdbx rev-parse FETCH_HEAD)" = "${LIBMDBX_COMMIT}" \
  && git -C /tmp/libmdbx checkout --detach FETCH_HEAD \
  && make -C /tmp/libmdbx mdbx_copy \
  && install -m 0755 /tmp/libmdbx/mdbx_copy /usr/local/bin/mdbx_copy

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN curl --fail --location --silent --show-error \
    "https://github.com/dojoengine/katana/releases/download/${KATANA_VERSION}/katana_${KATANA_VERSION}_linux_amd64.tar.gz" \
    --output /tmp/katana.tar.gz \
  && echo "${KATANA_ARCHIVE_SHA256}  /tmp/katana.tar.gz" | sha256sum --check --strict \
  && tar -xzf /tmp/katana.tar.gz -C /usr/local/bin katana \
  && chmod 0755 /usr/local/bin/katana

# Wolfi supplies the newer glibc required by the upstream Torii and Katana binaries
# without carrying Debian's currently unfixed High and Critical runtime findings.
FROM cgr.dev/chainguard/wolfi-base:latest@sha256:02dab76bd852a70556b5b2002195c8a5fdab77d323c433bf6642aab080489795

USER root

RUN apk add --no-cache \
    bash=5.3-r12 \
    ca-certificates=20260413-r0 \
    curl=8.21.0-r1 \
    libarchive-tools=3.8.8-r1 \
    nodejs-22=22.23.1-r1 \
    sqlite=3.53.3-r1 \
    util-linux=2.42.2-r0 \
    zstd=1.5.7-r7

COPY --from=mdbx-builder /usr/local/bin/katana /usr/local/bin/katana
COPY --from=torii /usr/local/bin/torii /usr/local/bin/torii
COPY --from=mdbx-builder /usr/local/bin/mdbx_copy /usr/local/bin/mdbx_copy
COPY entrypoint.sh /usr/local/bin/runtime-entrypoint.sh
COPY checkpoint-agent.sh /usr/local/bin/checkpoint-agent.sh
COPY healthcheck.sh /usr/local/bin/healthcheck.sh
COPY path-proxy.mjs /usr/local/bin/path-proxy.mjs
COPY render-torii-config.mjs /usr/local/bin/render-torii-config.mjs
COPY runtime-snapshot.mjs /usr/local/bin/runtime-snapshot.mjs

RUN chmod +x /usr/local/bin/runtime-entrypoint.sh /usr/local/bin/checkpoint-agent.sh /usr/local/bin/healthcheck.sh \
  && mkdir -p /data /runtime-control /snapshots /tmp \
  && chown -R 1000:1000 /data /runtime-control /snapshots /tmp

ENV DATA_DIR=/data
ENV SNAPSHOT_DIR=/snapshots
ENV SNAPSHOT_INTERVAL_SECONDS=300
ENV SNAPSHOT_RETAIN=12
ENV TAR_BIN=bsdtar
ENV PUBLIC_PORT=8080
ENV INTERNAL_PORT=8081

EXPOSE 5050 8080

USER 1000:1000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD ["/usr/local/bin/healthcheck.sh"]

ENTRYPOINT ["/usr/local/bin/runtime-entrypoint.sh"]
