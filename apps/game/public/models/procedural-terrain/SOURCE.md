# BIOME / 16 terrain props

Source: the user-supplied BIOME / 16 kit, manifest version 1.0.0. Its README describes all meshes and colors as original
procedural artwork, with no external image assets or textures. This catalog replaces the previous Quaternius runtime
catalog; its former CC0 attribution does not apply to these new assets.

The importer selects 15 reusable props, normalizes them to the game's existing placement scale, preserves their linear
vertex colors, adds foliage wind weights, and packs authored LOD1 / LOD2 into the near / far instancing contract. The
source IDs, individual source-file hashes, manifest hash, triangle counts and output hash are recorded in
`biome-kit-props.json`. Rebuild with:

```sh
pnpm --dir apps/game build:terrain-props -- --source-dir /path/to/biome-kit
```

The current continuous terrain, animated water and placement system remain the rendering path. The kit's standalone hex
slabs and creature companions are not part of this runtime catalog. Biome detail images use resized kit previews.
