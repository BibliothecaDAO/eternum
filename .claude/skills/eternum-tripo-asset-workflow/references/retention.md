# Runtime-only assets and bounded retention

The approved appearance is the target; retaining every high-density file is not. The user explicitly wants in-game model
requirements only in the repository and hosted comparison. Do not preserve millions of triangles merely to maintain a
live “ideal” viewer or duplicate raw archives through static files, compressed chunks or object storage.

## Working and delivery sets

- During concept/raw approval and baking, put complete provider meshes and original maps in ignored local scratch.
  Record provider task IDs, rights, hashes, settings and actual approval. Never silently substitute another raw mesh.
- Establish a rig-aware runtime working surface and test a representative moving joint, contact and attachment in the
  existing Three.js runtime before extensive polish. Bake useful source detail where appropriate; optimize measured
  triangles, material draws, texture memory and transfer size without sacrificing readable anatomy or costume.
- Keep one current compact editable model, only required maps, current runtime representations and removable gear. Keep
  reproducible scripts, rig/socket contracts, manifests, hashes and a selected matched image packet. A reduced reference
  must be labelled as such; it does not gain visual approval through cleanup.
- Keep at most the active repair checkpoint and one recovery checkpoint while iterating. Consolidate successful work and
  remove superseded checkpoints, redundant exports, Blender backups, scratch arrays and duplicate capture dumps. A
  failed diagnostic does not justify permanently retaining another complete asset package.

## Cleanup at a coherent handoff

Inventory dependencies before deletion. Validate current runtime files, required textures, source editability and
manifest hashes. Record removed path families/bytes and the retained source of truth. Retire scripts whose deleted
inputs are no longer available or label them historical; do not claim they can still rebuild the original master. Keep
enough lightweight provenance to explain prior approvals and reproduce the delivered runtime from the retained working
source. Delete superseded working payloads within this workflow; preserve unrelated user files. Git history rewrites,
remote bucket deletion and unrelated archives require their own scope, not an automatic cleanup ritual.

Use scoped ignore rules so raw payloads and generated archives cannot be accidentally committed. Do not create a new
backup archive containing everything just deleted. If an exceptional source really must be retained elsewhere, record
its owner and reason; external storage is not the default workaround for a bloated deliverable.

## Hosted comparison

Retain both the neutral art workshop and additive game-instance stage, using current in-game representations only. Keep
optional concept/material reference images small and lazy-loaded. Remove retired download controls and stale routes, or
redirect them clearly to the current review. Ship a manifest/allowlist of actual runtime dependencies, not entire source
folders. Share common model and texture URLs between views, load only needed families/representations, reuse GPU
resources and dispose replacements. Do not put Blender files, provider meshes, multi-million-triangle exports,
source-map dumps or old release archives into the public package.

Measure package contents before upload: per-model bytes/triangles, largest files, total static bytes, actual compressed
archive bytes and the host's current file/total limits. Leave headroom. A smaller package does not establish frame-rate
or mobile acceptance; measure the representative runtime scene separately. Diagnose a failed upload before repeating it,
and publish only a source-matched package. Remove obsolete local deployment archives after the replacement is verified;
never delete the archive of an in-flight save.
