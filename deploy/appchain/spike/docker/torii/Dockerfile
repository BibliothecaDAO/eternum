# torii v1.8.16 + multi-world GraphQL patch.
#
# Stock v1.8.16 panics at GraphQL schema build when two worlds register the
# same (namespace, name) model — "Field `s1EternumAgentConfigModels` already
# exists" — which kills the whole process. That is precisely our topology:
# one torii, N blitz worlds, all s1_eternum. The patch dedupes models by
# (namespace, name) when building the GraphQL schema (crates/graphql/src/
# schema.rs); SQL and gRPC remain fully world-scoped, and our client does not
# use GraphQL at all.
#
# The `torii` binary in this build context is produced by scripts/build-torii.sh
# (cargo release build of the patched checkout) and is gitignored.
# (no COPY --chmod: the legacy builder lacks BuildKit; the staged binary
# already carries the execute bit from the cargo build)
FROM ghcr.io/dojoengine/torii:v1.8.16
COPY torii /usr/local/bin/torii
