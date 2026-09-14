# syntax=docker/dockerfile:1
# The agent runner image: one hired agent's process, as the M3 supervisor starts it inside a 1 vCPU / 2 GB sandbox
# (docs/plans/hired-agents-architecture-brief.md §6). Nothing is installed at runtime: the deps stages install, the
# build stage builds, and the runtime stage carries only the production tree.
#
# Runtime is Bun rather than Node: the runner is TypeScript with extensionless imports and no build step, so the image
# runs the same `bun src/main.ts` the dev loop runs, and a Node image would need a bundling step whose only job is to
# recreate that.
#
# Build from the repository root, which is the context (the workspace lockfile and packages live there):
#   docker build -f apps/agent-runner/Dockerfile -t agent-runner:dev .

ARG BUN_VERSION=1.3.10
ARG PNPM_VERSION=10.25.0

FROM node:22-bookworm-slim AS base
ARG PNPM_VERSION
ENV CI=true PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate
WORKDIR /app
COPY . .

# The filter installs the runner and its workspace dependencies only. pnpm verifies its patches on full installs
# alone, so the game client's three/controller patches need no packages here.
FROM base AS build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@bibliothecadao/agent-runner..."
RUN pnpm --filter "@bibliothecadao/agent-runner^..." run build

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter "@bibliothecadao/agent-runner..."

# The repository layout is kept: the runner resolves the world manifest, the generated balance documents, and the
# workspace symlinks relative to the repository root, and pnpm's node_modules are relative symlinks into /app.
FROM oven/bun:${BUN_VERSION}-slim AS runtime
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/agent-runner/node_modules ./apps/agent-runner/node_modules
# The runner itself, by name: a local .agent-data (guest keys, runs) never rides along.
COPY apps/agent-runner/package.json apps/agent-runner/tsconfig.json ./apps/agent-runner/
COPY apps/agent-runner/src ./apps/agent-runner/src
COPY apps/agent-runner/templates ./apps/agent-runner/templates
# The five workspace packages the runner imports (`pnpm --filter "@bibliothecadao/agent-runner^..."`): production
# node_modules from prod-deps, dist from build.
COPY --from=prod-deps /app/packages/chain ./packages/chain
COPY --from=prod-deps /app/packages/types ./packages/types
COPY --from=prod-deps /app/packages/provider ./packages/provider
COPY --from=prod-deps /app/packages/dojo ./packages/dojo
COPY --from=prod-deps /app/packages/core ./packages/core
COPY --from=build /app/packages/chain/dist ./packages/chain/dist
COPY --from=build /app/packages/types/dist ./packages/types/dist
COPY --from=build /app/packages/provider/dist ./packages/provider/dist
COPY --from=build /app/packages/dojo/dist ./packages/dojo/dist
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY config/generated/blitz.madara.json config/generated/eternum.madara.json ./config/generated/
COPY contracts/l3/game/manifest_madara.json ./contracts/l3/game/manifest_madara.json
WORKDIR /app/apps/agent-runner
# The supervisor seeds and reads the agent's files here: soul, skills, memory, directions, runs, and the guest key.
ENV AGENT_DATA_DIR=/data
ENTRYPOINT ["bun", "src/main.ts"]
