# Compile contract artifacts once for the init image; Herald uses a separate runtime image.
FROM node:22-bookworm@sha256:dd5847a04b0deee391fa145f1f4c6d214196668b6bcc7988ebed67249f226844 AS build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git python3 && rm -rf /var/lib/apt/lists/*
COPY --from=oven/bun@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6 /usr/local/bin/bun /usr/local/bin/bun
RUN corepack enable
WORKDIR /app
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=8192
RUN pnpm install --frozen-lockfile && pnpm run build:packages
RUN for workspace in /app/contracts/l3/player-account /app/contracts/l3/world-native; do \
      version=$(awk '$1=="scarb" {print $2}' "$workspace/.tool-versions"); \
      mkdir -p "/tools/$version"; \
      curl --fail --location --retry 3 "https://github.com/software-mansion/scarb/releases/download/v$version/scarb-v$version-x86_64-unknown-linux-gnu.tar.gz" \
        | tar -xz --strip-components=1 -C "/tools/$version"; \
    done
RUN --mount=type=cache,target=/scarb-cache version=$(awk '$1=="scarb" {print $2}' /app/contracts/l3/player-account/.tool-versions) && \
    export XDG_CACHE_HOME=/scarb-cache/$version && cd contracts/l3/player-account && \
    for attempt in 1 2 3; do "/tools/$version/bin/scarb" fetch && break; test "$attempt" -lt 3 || exit 1; sleep 5; done && \
    "/tools/$version/bin/scarb" build
RUN --mount=type=cache,target=/scarb-cache version=$(awk '$1=="scarb" {print $2}' /app/contracts/l3/world-native/.tool-versions) && \
    export XDG_CACHE_HOME=/scarb-cache/$version && cd contracts/l3/world-native && \
    for attempt in 1 2 3; do "/tools/$version/bin/scarb" fetch && break; test "$attempt" -lt 3 || exit 1; sleep 5; done && \
    "/tools/$version/bin/scarb" build
RUN mkdir -p /release && bun contracts/l3/world-native/scripts/generate-schema.mjs --check && \
    bun deploy/release/facts.ts > /release/release-facts.json && \
    bun build apps/herald/src/server.ts --target=bun --outfile=/release/herald.js && \
    bun build deploy/athanor/scripts/read-rpc.ts --target=bun --outfile=/release/read-rpc.js

FROM oven/bun@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6 AS herald
WORKDIR /app
COPY --from=build /release/herald.js /app/herald.js
COPY --from=build /release/read-rpc.js /app/read-rpc.js
USER bun
ENTRYPOINT ["bun", "/app/herald.js"]

FROM build AS init
# Initialization consumes the compiled artifacts; it never downloads or compiles contracts on the host.
ENTRYPOINT ["python3", "/app/deploy/shard/init.py"]
