# The stamping runtime has no world-contract dependency, so its image target can be verified separately.
FROM rust:1.89-bookworm AS vrf-build
WORKDIR /prover
COPY deploy/athanor/vrf/prover/ ./
RUN cargo build --release --locked

FROM node:22-bookworm@sha256:dd5847a04b0deee391fa145f1f4c6d214196668b6bcc7988ebed67249f226844 AS proxy-assets
COPY --from=oven/bun@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6 /usr/local/bin/bun /usr/local/bin/bun
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN mkdir -p /proxy && bun build deploy/athanor/scripts/read-rpc.ts --target=bun --outfile=/proxy/read-rpc.js && \
    bun build deploy/athanor/vrf/worker.ts --target=bun --outfile=/proxy/worker.ts

FROM oven/bun@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6 AS proxy-runtime
WORKDIR /app
COPY --from=proxy-assets /proxy/ /app/
COPY --from=vrf-build /prover/target/release/librealms_vrf_prover.so /app/prover/target/release/librealms_vrf_prover.so
USER bun
ENTRYPOINT ["bun", "/app/read-rpc.js"]

# Compile contract artifacts once for the init image; Herald uses a separate runtime image.
FROM node:22-bookworm@sha256:dd5847a04b0deee391fa145f1f4c6d214196668b6bcc7988ebed67249f226844 AS contracts
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
RUN version=$(awk '$1=="scarb" {print $2}' /app/contracts/l3/world-native/.tool-versions) && \
    cd contracts/l3/vrf-verifier && "/tools/$version/bin/scarb" build && \
    cd /app && bun contracts/l3/vrf-verifier/scripts/pin-class.ts --check
RUN --mount=type=cache,target=/scarb-cache version=$(awk '$1=="scarb" {print $2}' /app/contracts/l3/world-native/.tool-versions) && \
    export XDG_CACHE_HOME=/scarb-cache/$version && cd contracts/l3/world-native && \
    for attempt in 1 2 3; do "/tools/$version/bin/scarb" fetch && break; test "$attempt" -lt 3 || exit 1; sleep 5; done && \
    "/tools/$version/bin/scarb" build
# Keep the compiled artifacts available for schema generation without repeating the package assembly.
FROM contracts AS build
RUN version=$(awk '$1=="scarb" {print $2}' /app/contracts/l3/world-native/.tool-versions) && \
    export PATH="/tools/$version/bin:$PATH" && \
    mkdir -p /release && bun contracts/l3/world-native/scripts/generate-schema.mjs --check && \
    bun deploy/release/facts.ts > /release/release-facts.json && \
    bun build apps/herald/src/server.ts --target=bun --outfile=/release/herald.js

FROM oven/bun@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6 AS herald
WORKDIR /app
COPY --from=build /release/herald.js /app/herald.js
COPY --from=proxy-assets /proxy/ /app/
COPY --from=vrf-build /prover/target/release/librealms_vrf_prover.so /app/prover/target/release/librealms_vrf_prover.so
USER bun
ENTRYPOINT ["bun", "/app/herald.js"]

FROM build AS init
COPY --from=vrf-build /prover/target/release/librealms_vrf_prover.so /app/deploy/athanor/vrf/prover/target/release/librealms_vrf_prover.so
# The harness runs as the host user and writes each game's launch summary here.
RUN mkdir -m 1777 /app/.context
# The image carries no repository, so commands run from it record this commit as the code they ran.
ARG SHARD_REVISION
ENV SHARD_REVISION=${SHARD_REVISION}
# Initialization consumes the compiled artifacts; it never downloads or compiles contracts on the host.
ENTRYPOINT ["python3", "/app/deploy/shard/init.py"]
