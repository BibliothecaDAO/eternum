# W2 Codex Brief — Neutral `s2` Namespace + Two-World Build Profiles

Context: `docs/plans/phase-2-dual-world-architecture.md` (§4.1–4.2, amendments §0.1). Branch: `feat/single-world-blitz`.
Owner-ratified; KISS applies — this is a mechanical rename + build-profile split, not a redesign. The dev katana will be
REMADE from scratch after this lands (S4), so no migration/back-compat with the existing `s2_blitz` world is needed
anywhere.

## Outcome

One Cairo build that deploys as either of two worlds on the shared appchain:

- Namespace **`s2`** (renamed from `s2_blitz`) — shared by both worlds, mode-neutral.
- `sozo migrate --profile appchain_blitz` → blitz world (seed `s2_blitz_1`) → committed
  `contracts/l3/game/manifest_appchain_blitz.json`.
- `sozo migrate --profile appchain_eternum` → eternum world (seed `s2_eternum_1`) → committed
  `contracts/l3/game/manifest_appchain_eternum.json` (address placeholders fine until the W4 deploy; the profile +
  manifest generation path must work).

## Deliverables

1. **Rename `s2_blitz` → `s2`** in contracts + tooling:
   - `contracts/l3/game/src/constants.cairo` — `DEFAULT_NS()` / `DEFAULT_NS_STR()` → `"s2"`.
   - Dojo profile config: `[namespace] default`, every `[writers]` key, every `lib_versions` key.
   - `config/deployer/**` — all `s2_blitz-` model/table references (registrar tooling, `game-registry.ts` lookups,
     run-store, launch runner, environments config) and any namespace constants.
   - `.github/workflows/**` and `config/**` scripts that carry the string.
   - Gate: `git grep -l "s2_blitz"` returns ONLY historical docs (`docs/plans/**` may keep it) and this brief. No
     source/tooling/workflow hits.
2. **Profile split**: replace `dojo_appchain.toml` with `dojo_appchain_blitz.toml` + `dojo_appchain_eternum.toml` —
   identical except `[world] seed` (`s2_blitz_1` / `s2_eternum_1`) and world name/description. Add the matching Scarb
   profile plumbing so both `sozo --profile` invocations work from one `sozo build`. Same rpc_url (one chain — MVP
   topology S2).
3. **Pipeline env**: `appchain.blitz` / `appchain.eternum` environments resolve to (world manifest, registrar address)
   per world — parameterized so the eternum world's address is a one-line config entry when W4 deploys it. Blitz
   launches must work end-to-end against the blitz profile; eternum launches may hard-fail with a clear "world not
   deployed yet" until W4.
4. **Bindings**: regenerate `packages/types/src/dojo/contract-components.ts` if the generator embeds the namespace
   anywhere (it should not — namespace is a `defineContractComponents` runtime parameter); update generator tests that
   pin `s2_blitz` strings. Run prettier on generated output before diffing.
5. **Checks**: `scarb build` green; `pnpm test` green in `config/` and `packages/types`; the grep gate above.

## Explicitly NOT yours (Claude follows up)

- Everything under `client/` (game-scope constants, world directory, manifest imports) — Claude.
- `deploy/appchain/cdk/**` (chain remake, torii services) — Claude.
- The actual dev-chain remake, world deploys, and config runs — Claude, after review.

## Constraints

- Never use the paymaster account (`0x127f…cfcec`) in tooling; pipeline account only.
- Never commit to `feat/appchain-phase-1`.
- When removing a Cairo assert, comment it out rather than delete.
- No drive-by refactors — rename + profiles + pipeline parameterization only. W3 (eternum system migration) is a
  separate brief.

## Handoff back

Report: commit range, the grep-gate output, and both manifest files' generation commands. Claude then reviews, remakes
the dev chain, migrates + configures the blitz world, and updates client/infra.
