ARG DOJO_VERSION=v1.8.16

FROM ghcr.io/dojoengine/dojo:${DOJO_VERSION} AS dojo

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=dojo /usr/local/bin/katana /usr/local/bin/katana
COPY --from=dojo /usr/local/bin/torii /usr/local/bin/torii
COPY entrypoint.sh /usr/local/bin/runtime-entrypoint.sh
COPY healthcheck.sh /usr/local/bin/healthcheck.sh
COPY path-proxy.mjs /usr/local/bin/path-proxy.mjs
COPY render-torii-config.mjs /usr/local/bin/render-torii-config.mjs

RUN chmod +x /usr/local/bin/runtime-entrypoint.sh /usr/local/bin/healthcheck.sh

ENV DATA_DIR=/data
ENV PUBLIC_PORT=8080
ENV INTERNAL_PORT=8081

EXPOSE 5050 8080

ENTRYPOINT ["/usr/local/bin/runtime-entrypoint.sh"]
