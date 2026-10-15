# The native prover is built once and shipped in the init and Herald runtimes.
FROM rust:1.89-bookworm@sha256:948f9b08a66e7fe01b03a98ef1c7568292e07ec2e4fe90d88c07bb14563c84ff AS vrf-build
WORKDIR /prover
COPY deploy/athanor/vrf/prover/ ./
RUN cargo build --release --locked

FROM node:22-bookworm@sha256:dd5847a04b0deee391fa145f1f4c6d214196668b6bcc7988ebed67249f226844 AS proxy-assets
COPY --from=oven/bun@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6 /usr/local/bin/bun /usr/local/bin/bun
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN mkdir -p /proxy && bun build deploy/athanor/scripts/read-rpc.ts --target=bun --outfile=/proxy/read-rpc.js

# Compile contract artifacts once for the init image; Herald uses a separate runtime image.
FROM node:22-bookworm@sha256:dd5847a04b0deee391fa145f1f4c6d214196668b6bcc7988ebed67249f226844 AS contracts
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git python3 util-linux && rm -rf /var/lib/apt/lists/*
COPY --from=oven/bun@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6 /usr/local/bin/bun /usr/local/bin/bun
RUN corepack enable
WORKDIR /app
# Only contract inputs invalidate Cairo layers. Application and deployment code is copied after compilation.
COPY contracts/l3/player-account/ contracts/l3/player-account/
COPY contracts/l3/world-native/ contracts/l3/world-native/
COPY contracts/l3/vrf-verifier/ contracts/l3/vrf-verifier/
RUN for workspace in /app/contracts/l3/player-account /app/contracts/l3/world-native; do \
      version=$(awk '$1=="scarb" {print $2}' "$workspace/.tool-versions"); \
      mkdir -p "/tools/$version"; \
      curl --fail --location --retry 3 "https://github.com/software-mansion/scarb/releases/download/v$version/scarb-v$version-x86_64-unknown-linux-gnu.tar.gz" \
        | tar -xz --strip-components=1 -C "/tools/$version"; \
    done
RUN --mount=type=cache,target=/scarb-cache version=$(awk '$1=="scarb" {print $2}' /app/contracts/l3/player-account/.tool-versions) && \
    export XDG_CACHE_HOME=/scarb-cache/$version && cd contracts/l3/player-account && \
    for attempt in 1 2 3; do "/tools/$version/bin/scarb" fetch && break; test "$attempt" -lt 3 || exit 1; sleep 5; done && \
    taskset -c 8-11 "/tools/$version/bin/scarb" build
RUN version=$(awk '$1=="scarb" {print $2}' /app/contracts/l3/world-native/.tool-versions) && \
    cd contracts/l3/vrf-verifier && taskset -c 8-11 "/tools/$version/bin/scarb" build
RUN --mount=type=cache,target=/scarb-cache version=$(awk '$1=="scarb" {print $2}' /app/contracts/l3/world-native/.tool-versions) && \
    export XDG_CACHE_HOME=/scarb-cache/$version && cd contracts/l3/world-native && \
    for attempt in 1 2 3; do "/tools/$version/bin/scarb" fetch && break; test "$attempt" -lt 3 || exit 1; sleep 5; done && \
    taskset -c 8-11 "/tools/$version/bin/scarb" build
# Keep the compiled artifacts available for schema generation without repeating the package assembly.
FROM contracts AS build
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=8192
RUN pnpm install --frozen-lockfile && pnpm run build:packages
RUN bun contracts/l3/player-account/check-class-hash.ts && \
    bun contracts/l3/vrf-verifier/scripts/pin-class.ts --check
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

# Setup exports value artifacts from this image; no compiler runs on the host.
FROM node:22-bookworm@sha256:dd5847a04b0deee391fa145f1f4c6d214196668b6bcc7988ebed67249f226844 AS value-contracts
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git util-linux && rm -rf /var/lib/apt/lists/*
RUN mkdir /tools && curl --fail --location --retry 3 \
    https://github.com/software-mansion/scarb/releases/download/v2.13.1/scarb-v2.13.1-x86_64-unknown-linux-gnu.tar.gz \
    | tar -xz --strip-components=1 -C /tools
WORKDIR /app
COPY contracts/l3/world-native/src/days.cairo contracts/l3/world-native/src/days.cairo
COPY contracts/l2/ledger/ contracts/l2/ledger/
COPY contracts/l2/mmr/ contracts/l2/mmr/
COPY contracts/l2/collectibles/ contracts/l2/collectibles/
RUN --mount=type=cache,target=/scarb-cache export XDG_CACHE_HOME=/scarb-cache/2.13.1 && \
    for package in ledger mmr collectibles; do (cd contracts/l2/$package && taskset -c 8-11 /tools/bin/scarb --release build) || exit; done
