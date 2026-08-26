# Appchain M0 spike

Local validation stack for Phase 1 of the appchain migration — see
`docs/plans/appchain-phase-1.md`. This spike answers the two questions that
gate all AWS work:

1. **Multi-world torii** — does ONE torii instance cleanly index and serve two
   blitz worlds (same `s1_eternum` namespace, same models), with world-scoped
   queries and no cross-world bleed, through our client's SDK versions?
2. **Controller on a custom chain** — does Cartridge Controller login + session
   creation + paymaster-relayed execution work against a self-hosted katana
   with chain id `WP_REALMS_DEV`?

## Stack

| Piece | Version | Notes |
|---|---|---|
| katana | v1.8.0-rc.9 | + vrf-server (source build, rev 65d6ff0) + paymaster-service v0.2.4 baked into the image — see `docker/katana/Dockerfile` for why |
| torii | v1.8.16 | one instance, two `WORLD:` entries |
| chain id | `WP_REALMS_DEV` | felt `0x57505f5245414c4d535f444556` |
| accounts | katana dev seed `"0"` | account 0 matches `contracts/game/dojo_local.toml` |

## Run

```sh
cd deploy/appchain/spike
docker-compose up -d --build        # katana + heartbeat (first build is slow: rust compile of vrf-server)
scripts/deploy-worlds.sh            # sozo build once, migrate two worlds, render torii/torii.toml
docker-compose --profile torii up -d
scripts/verify.sh                   # automated checks + evidence to eyeball
```

`deploy-worlds.sh` clones `contracts/game/dojo_local.toml` to `dojo_spike.toml`
and swaps the world seed between migrations — one build, two worlds, mirroring
what the world factory does on-chain in production. `dojo_spike.toml` /
`manifest_spike.json` are gitignored.

Reset everything: `docker-compose --profile torii down -v`

## Findings so far (things M0 already caught)

1. **sozo 1.8.0 (repo pin) cannot talk to katana rc.9** — rc.9 serves Starknet
   RPC 0.10, sozo 1.8.0 expects 0.9 *and exits 0 on the error*. Use sozo 1.8.7
   (cagecalls' `~/cagecalls/cairo/.tool-versions` pins the same). The M3
   `appchain` profile work must bump the toolchain for appchain migrations.
2. **sozo 1.8.7 panics on profiles without `rpc_url`** under `[env]`
   (blake2s autodetect unwraps it). `dojo_local.toml` has no `rpc_url` and its
   `[lib_versions]` is stale (missing `raid_library`, old versions) —
   `deploy-worlds.sh` patches both into the generated spike profile.
3. **torii 1.8.16 GraphQL panics on multi-world with same-named models**
   (`Field 's1EternumAgentConfigModels' already exists`) and takes the process
   down. Indexing/SQL/gRPC are correctly world-scoped; only the GraphQL
   dynamic schema lacks world disambiguation, and our client doesn't use
   GraphQL. Fixed by a fork patch (dedupe models by namespace+name at schema
   build) baked into `docker/torii/`; upstream issue draft in `upstream/`.

## Validation checklist

### A. Chain basics (`scripts/verify.sh`) — ✅ all passed 2026-08-03

- [x] `starknet_chainId` returns `WP_REALMS_DEV`
- [x] UDC predeployed at `0x041a78e7…02bf` (the address `contracts/game/src/constants.cairo` hardcodes)
- [x] Heartbeat advances the block height while idle
- [x] Paymaster v0.2.4 bootstrapped (forwarder `0x11a267ea…baf3`); VRF provider
      (`VrfAccount`) at `0x4da58dd0…7490`, whitelisted on the forwarder —
      M2's config deploy needs the provider address, always read it off the chain

### B. Multi-world torii — ✅ passed with patched image, 2026-08-03

- [x] All worlds appear in `SELECT DISTINCT world_address FROM models`
      (3 worlds × 102 models each, counts identical)
- [x] GraphQL serves after the dedupe patch (introspection 200; stock 1.8.16
      panicked and killed the process — see Findings)
- [x] World-append flow: third world migrated, `WORLD:` entry appended to
      `torii/torii.toml`, torii recreated (`docker rm -f` first — compose v1
      `--force-recreate` hits `KeyError: 'ContainerConfig'` on modern engines)
      → world 3 indexed, worlds 1–2 data intact through the restart. This is
      the production `create-indexer` replacement.
- [ ] gRPC/SDK: point a dojo.js client (torii-wasm 1.8.2) at world 1 and
      confirm subscriptions only deliver world-1 entities (do together with C)

### C. Controller / session — ✅ passed 2026-08-03 (automated via playwright)

The Controller check used a standalone fixture that was removed after this spike passed.

**Local testing requires an https tunnel for the RPC** — the hosted keychain
iframe (`https://x.realms.world`) cannot fetch `http://localhost` under
Chrome's Local Network Access rules, which surfaces as **"No chainId"** in the
connect modal. Run `cloudflared tunnel --url http://localhost:5050` and open
the page as `?rpc=https://<tunnel>.trycloudflare.com`. Irrelevant on the
deployed M1 stack (public https RPC).

- [x] Keychain accepts chain `WP_REALMS_DEV` (bespoke id, via tunnel)
- [x] Password login (test account `zkubetest`), session-consent screen
      (tick "permissions not verified" → CONTINUE)
- [x] Session call executed with no wallet popup — receipt SUCCEEDED, and the
      tx **sender is the paymaster relayer** (`0x54b9b1…41741`): relayed as an
      outside-execution, the production path
- [x] Controller account auto-deployed on first use (`--cartridge.controllers`)
- [ ] MOVED TO M3: game-client SDK (torii-wasm) world-scoped subscription
      check — needs the client `appchain` chain arm to exist first

### D. Open investigation

- [x] What replaces the launch flow's `sync-paymaster` step (Cartridge-hosted
      paymaster policies via slot CLI) when the paymaster is katana-embedded?
      **Confirmed 2026-08-06: nothing.** The session call executed with zero
      server-side policy registration — policies were client-provided (hence
      the "not verified" consent state) and the embedded paymaster relayed
      without any Cartridge-side sync. `create-indexer`'s sibling
      `sync-paymaster` becomes a no-op for the `appchain` provider. (Verified
      policy status / removing the red consent box is a separate, cosmetic
      Cartridge registration question for M3.)

## Exit criteria

A blitz action executes from a real client against this stack, and every box
in A–C is ticked. If B or C fails structurally (not a config issue), STOP —
escalate before any AWS work; fallbacks are per-game torii (B) or predeployed
accounts (C), both plan-changing decisions.
