# Appchain deployment scripts

The A2 single-world bootstrap is reviewer-run once per chain. First migrate the persistent world, then wire its shared
collectibles and register the chain configuration and default preset:

```bash
cd contracts/game
sozo build --profile appchain-blitz
sozo migrate --profile appchain-blitz
mv manifest_appchain-blitz.json manifest_appchain_blitz.json

cd ../..
DOJO_ACCOUNT_ADDRESS=0x... \
DOJO_PRIVATE_KEY=0x... \
S2_OPERATOR_ADDRESS=0x... \
ENTRY_TOKEN_ADDRESS=0x... \
LOOT_CHEST_ADDRESS=0x... \
bun deploy/appchain/scripts/deploy-s2-world.ts
```

The Eternum world uses the same build with its own seed and manifest:

```bash
cd contracts/game
sozo build --profile appchain-eternum
sozo migrate --profile appchain-eternum
mv manifest_appchain-eternum.json manifest_appchain_eternum.json
```

Scarb profile IDs require hyphens. The canonical Dojo configs and committed manifests keep the underscore names from
the phase-2 plan; the tracked `dojo_appchain-*.toml` symlinks bridge the profile IDs to those files.

Use the same `DOJO_ACCOUNT_ADDRESS` / `DOJO_PRIVATE_KEY` for migration and the script: that account must own the
`s2-registrar_systems` resource before it can initialize `ChainConfig`.

`RPC_URL` and `TORII_URL` override the appchain defaults. Chain-level address overrides are
`VRF_PROVIDER_ADDRESS`, `AGENT_CONTROLLER_ADDRESS`, `FEE_TOKEN_ADDRESS`, `FEE_RECIPIENT_ADDRESS`,
`COSMETICS_ADDRESS`, `TIMELOCK_ADDRESS`, and `ELITE_NFT_ADDRESS`. The script safely skips an indexed `ChainConfig` or
preset and treats their write-once registrar errors as already complete. Use `--dry-run` to prepare role grants and print
the full preset calldata without sending transactions. `APPCHAIN_MANIFEST_PATH` can select another migrated manifest,
for example `contracts/game/manifest_spike.json` during local verification; the tracked Blitz manifest remains the
default.

The old `factory-config.ts` and `factory-create-game.ts` scripts are retained only as A2 migration history. They must not
be used for `s2` launches.
