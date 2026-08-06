# Realms Appchain — Phase 1 Plan

_Status: approved plan, implementation starting with M0 (2026-08-02)._

## Why

Slot is EoL and Starknet mainnet gas is too expensive for Blitz. We move the game to a
self-hosted Katana appchain on AWS, in two phases:

- **Phase 1 (this doc)** — a sovereign dev appchain: no mainnet link, free entry, a test
  environment where we can play, test, and break things. Fastest path to a deploy.
- **Phase 2 (separate stack, later)** — a settling chain booted via `katana init rollup`:
  katana's embedded settlement service proves blocks and posts `update_state` to a piltover
  core on Starknet mainnet (saya is dead — settlement is in katana now). Real economy:
  entry in LORDS on mainnet, prizes claimable on mainnet after proven settlement via
  L1↔L2 messaging (the cartridge-gg/dungeon-demo entry/bank pattern). TEE attestation:
  mock first; real SEV-SNP deferred (sealed tee-vm images are bare-metal oriented, not
  EC2-viable — this is the swamp the drafted PRs #4873/#4864 drowned in; do not resurrect
  their architecture).

Everything moves to AWS: chain, indexer, game client (currently Vercel), realtime-server,
DNS (Route53 replaces Cloudflare), and the two Cloudflare workers (torii-creator is
deleted outright; realms-game-launch becomes a Lambda).

## Key decisions

| Decision | Choice |
|---|---|
| Topology | **One katana + ONE shared torii indexing all game worlds** (multi-world torii, verified in torii 1.8.x: multiple `WORLD:` entries in `indexing.contracts`, storage/queries scoped by `world_address`). No per-game torii, no per-game katana. |
| Game creation | Factory-driven, automated from day 1: cron 11:00 UTC + on-demand dispatch. Blitz first; eternum later on the same chain. |
| Katana home | **EC2** (m6a.large to start, resize path to xlarge) — instance-attached EBS survives task/instance changes, so resizing does NOT reset the chain. Fargate was rejected for katana: its EBS is task-scoped, so any task-def change destroys the chain (a cagecalls production lesson, fired twice). |
| Torii home | Fargate 2 vCPU/4GB (reindexable from chain, so task-scoped volume is acceptable). |
| Versions | katana `v1.8.0-rc.9` (+ vrf-server built from source, paymaster v0.2.4 pinned+checksummed), torii `v1.8.16` **with our multi-world GraphQL patch** (stock panics on duplicate model fields across worlds — M0 finding, see `deploy/appchain/spike/upstream/`). sozo `1.8.7` for appchain migrations (repo-pinned 1.8.0 only speaks RPC 0.9; rc.9 serves 0.10 — and 1.8.0 exits 0 on the version error). Same pins as cagecalls (`~/cagecalls/cairo` also pins sozo 1.8.7); their workarounds ported as code. |
| Chain id | `WP_REALMS_DEV` (bespoke id — never `SN_SEPOLIA`; the Controller keychain must distinguish this chain, another cagecalls lesson). |
| Networking | Public subnets + security groups (inbound from ALB only). **No NAT gateway** (~$11/mo public IPs vs $35–45 NAT). One ALB, host-routed. AWS WAF for rate limiting. |
| DNS/TLS | Route53 hosted zone for `appchain.realms.world` (NS-delegated from the parent zone), ACM DNS-validated certs. Phase 1 hosts: `katana.dev.appchain.realms.world`, `torii.dev.…`, `rt.dev.…`. |
| Infra code | CDK app in `deploy/` (this repo), constructs ported from `~/cagecalls/devops` (replaces the unused GCP scaffold). |
| Client hosting | S3 + CloudFront (replaces Vercel; `vercel.json` semantics map to a CF function + response-headers policy). Realtime-server → Fargate + RDS `db.t4g.micro`. No PR previews in v1. |
| Contracts | **No Cairo changes in Phase 1.** UDC is predeployed by katana at the address `constants.cairo` expects; VRF via the vrf-server sidecar (provider address read off the running chain — never hardcoded); free entry = `fee_amount: 0`. Peripherals (collectibles, MMR token, test LORDS) redeployed chain-locally with existing scripts. |

### Sizing rationale (katana)

"Hundreds of game-tx/min" during a 1h Blitz becomes **~500–700 chain-tx/min at peak**:
every session tx arrives paymaster-wrapped as an outside-execution, and every
VRF-consuming action adds a `submit_random` tx. Execution at that rate is comfortable for
katana on a few real cores; the pressure points are client RPC polling, the two sidecars,
and memory. Today's Blitz slot instance runs Slot's `epic` tier — 1 vCPU/2GB (cagecalls'
size) is known-wrong for us. Start m6a.large (2 vCPU/8GB), resize to m6a.xlarge in ~5 min
with the chain intact if game-hour metrics say so. Cairo-native builds of rc.9 exist as an
execution-headroom escape hatch.

## Architecture

```
                     Route53: appchain.realms.world (delegated zone)
                                     │
                         ALB (HTTPS, ACM, WAF rate-limit)
                  host routing:  katana.dev │ torii.dev │ rt.dev
     ┌───────────────────────────────────────────────────────────────┐
     │ ECS cluster (public subnets, SG-locked to ALB, no NAT)        │
     │                                                               │
     │  Katana — EC2 launch type, m6a.large → xlarge resize path     │
     │    katana v1.8.0-rc.9 + vrf-server + paymaster + heartbeat    │
     │    chain id WP_REALMS_DEV · dev/no-fee · EBS 50GB on instance │
     │                                                               │
     │  Torii — Fargate 2vCPU/4GB, v1.8.16                           │
     │    ONE instance, multi-world: factory + global + game worlds  │
     │    config template in SSM, rendered at boot, EBS task volume  │
     │                                                               │
     │  Realtime-server — Fargate 0.5vCPU/1GB ── RDS db.t4g.micro    │
     └───────────────────────────────────────────────────────────────┘
  S3+CloudFront: game client, docs, snapshots     Lambda+DynamoDB: launch
  DLM: scheduled EBS snapshots                    dispatch + run store
```

Katana specifics carried over from cagecalls (hard-won, port verbatim):

- `--chain-id`, `--cartridge.controllers`, `--paymaster`, `--cartridge.paymaster`,
  `--paymaster.bin`, `--vrf`, `--vrf.bin` go on the **CLI, not the TOML** (rc.9's
  config-file path for them is broken: `chain_id` silently ignored, `[cartridge]` in TOML
  panics VRF startup).
- vrf-server built from source at cartridge-gg/vrf rev `65d6ff0` (released 0.3.1 rejects
  rc.9's untagged outside-execution JSON); consumed via `--vrf.bin`.
- paymaster-service v0.2.4, sha256-verified at container start (image's asdf-installed
  0.2.3 rejects hex chain ids and kills the node). `--paymaster.url` is NOT an
  alternative (external mode skips forwarder bootstrap).
- No `--block-time` (broken on rc.9: one block then frozen head) — a heartbeat sidecar
  POSTs `dev_generateBlock` every 30s so `get_block_timestamp` advances when idle;
  gameplay txs mine instantly.
- HTTP/1.1 target groups only (HTTP2 target groups reject non-browser clients with 464).
- Health check accepts 200–499 (JSON-RPC returns 405 to GET, which proves liveness).
- VRF **provider** address is read off the running chain after boot — the provider moves
  on katana version bumps, and the provider-vs-consumer mixup was a live bug at cagecalls.
- The `/sql` endpoint stays public (our client depends on it) behind WAF rate limiting —
  divergence from cagecalls, revisit in Phase 2.

## Milestones

### M0 — Validation spike (1–2 days, gates everything)

Local docker stack: custom katana image + torii 1.8.16. Deploy the factory and two blitz
worlds (same namespace, same models — the multi-world stress case). Verify:

1. **Multi-world torii vs our client** — SQL results world-scoped (no cross-world bleed),
   gRPC subscriptions per world, torii-wasm 1.8.2 / SDK 1.7-preview compatibility.
2. **Controller on `WP_REALMS_DEV`** — keychain accepts the chain, session creation with
   our policies, paymaster relays outside-executions end to end.
3. Smaller checks: UDC at the expected address; VRF provider discovery; what (if anything)
   replaces the `sync-paymaster` launch step when the paymaster is katana-embedded.

Exit: a blitz action executes from the real game client against the local multi-world
stack. If (1) or (2) fails, stop and solve that before any AWS work.
Spike lives in `deploy/appchain/spike/`.

### M1 — Infra up (2–4 days)

CDK app in `deploy/`: VPC (public subnets, 2 AZs), ECS cluster, katana EC2 service +
instance EBS, torii Fargate service, single ALB + WAF + ACM, Route53 zone, Cloud Map
(torii→katana in-VPC), monitoring construct (alarms→SNS→email), DLM snapshots, ECR,
GH Actions OIDC (image build + cdk deploy workflows).
Exit: both services green on HTTPS; a killed task alarm reaches the inbox.

**Inputs needed (in order):**

1. **AWS account + region** — dedicated 12-digit account id; region `us-east-1` unless
   the player base says EU. First deploy is from human credentials (SSO profile with
   AdminAccess; `aws sts get-caller-identity` must show the account), then
   `cdk bootstrap aws://<ACCOUNT>/<REGION>`. Day-1: request EC2 On-Demand vCPU quota bump
   to 16–32 (new accounts default to 5), create a billing budget alarm ($300/$500).
2. **NS delegation** — CDK creates the `appchain.realms.world` zone and outputs 4
   nameservers; whoever controls `realms.world` (Cloudflare) adds one NS record
   `appchain → <4× awsdns-*>`. Hard ordering dependency: ACM cert validation hangs until
   the delegation is live.
3. **Alert email** — a group alias, subscribed to SNS; each subscriber must click the
   confirmation email once (unconfirmed = silent).
4. **GitHub OIDC** — CDK creates roles `gha-appchain-deploy` (CDK bootstrap roles),
   `gha-appchain-image` (ECR push), `gha-appchain-launch` (SSM torii-config param +
   `ecs:UpdateService` only), trust-scoped to `repo:BibliothecaDAO/eternum`. Repo admin
   creates environment `appchain-dev` with vars `AWS_ACCOUNT_ID`, `AWS_REGION`,
   `AWS_DEPLOY_ROLE_ARN`, `AWS_LAUNCH_ROLE_ARN`, `AWS_IMAGE_ROLE_ARN`; org settings must
   allow `id-token: write` and `aws-actions/configure-aws-credentials`. Existing secrets
   (SLOT_AUTH…) untouched until Phase 1 signs off.

### M2 — Chain bootstrap (1–2 days)

One scripted runbook (rerun after every reset): migrate factory world
(`dojo_appchain.toml`) → deploy global world → deploy chain-local peripherals
(lootchest/cosmetics/timelock/elite collectibles, MMR token, test LORDS) → read VRF
provider address off the chain → write `contracts/common/addresses/appchain.json` →
config deploy (`blitz.appchain.json`, `fee_amount: 0`) → render torii config (factory +
global + ERC entries) and restart torii.
Exit: factory world indexed and visible in the admin UI.

### M3 — Client + deployer integration (3–5 days)

- New `appchain` arm: `Chain` unions (`contracts/utils/utils.ts`), `env.ts` enum,
  `appchain.blitz` deployer environment, `config/source/blitz/chains.ts`,
  `.env.appchain.blitz`.
- `starknet-chain-config.ts`: hand-rolled Chain object + chain-id resolution for our host
  (today non-cartridge URLs silently fall back to the slot chain id);
  `controllerSupportedRpcUrls`; slot arms kept for rollback.
- Endpoint simplification: one static RPC + one static torii URL + world address from the
  factory. Fix play-path `api.cartridge.gg` hardcodes first (`services/api.ts`, world
  availability, explorer links); sweep the other ~25 opportunistically.
- Deployer: new `appchain` indexer provider — `create-indexer` becomes _append
  `WORLD:<addr>:<block>` to the SSM config → force torii redeploy → wait healthy → verify
  world responds_. Slot provider stays selectable as rollback.

Exit: full launch flow runs against the appchain; a game is playable end to end.

### M4 — Automation + ops (2–3 days)

- `game-launch.yml`: cron `0 11 * * *` for `appchain.blitz` + manual dispatch; torii
  world-append step wired in. (Daily torii restart happens at game creation, seconds
  long, before players join.)
- Launch Lambda ports the `realms-game-launch` worker (GH-token-safe dispatch + run
  store; git-branch store initially, DynamoDB later; token in Secrets Manager). The
  `torii-creator` worker dependency is deleted — shared torii removes its reason to exist.
- Runbooks written **and drilled once each**: chain reset, katana resize, snapshot
  restore, torii reindex.

Exit: a game launches unattended at 11:00 UTC two days in a row.

### M5 — Client hosting migration (parallel track, 1–2 days)

S3+CloudFront for game + docs, GH Actions deploy, realtime-server → Fargate + RDS, DNS
cutover. Keep Vercel only if per-PR previews are missed.

### Wrap — chaos day

Kill the katana task; restore from snapshot; full chain reset drill; capture game-hour
metrics (katana CPU/mem at peak tx rate, torii p95) → sizing verdict + ops baseline for
Phase 2.

## Cost (monthly, us-east-1)

| Item | Sizing | ~$/mo |
|---|---|---|
| Katana (EC2) | m6a.large 2vCPU/8GB (→ xlarge: $126) | 63 |
| Torii (Fargate) | 2 vCPU/4GB | 72 |
| Realtime-server (Fargate) | 0.5 vCPU/1GB | 18 |
| RDS Postgres | db.t4g.micro | 15 |
| ALB (single, host-routed) | | 25 |
| Public IPv4 ×3 (replaces NAT) | | 11 |
| EBS + DLM snapshots | 50+20 GB gp3 | 8 |
| CloudWatch logs + alarms | | 10–25 |
| S3 + CloudFront | client/docs, CF free tier | 0–15 |
| Route53/ECR/Secrets/SNS/Lambda/DDB | | 5 |
| Player egress | dev scale | 5–20 |
| **Total** | | **≈ $230–275** |

~25% off compute with a 1-year Compute Savings Plan once stable. Phase 2 adds a similar
compute footprint plus **mainnet settlement gas** — the make-or-break variable; block
cadence swings it from ~$60/mo to thousands, measured at the sepolia dry run.

## Risks

| Risk | Mitigation |
|---|---|
| SDK ↔ multi-world torii incompat | M0 gate. **Materialized once**: stock torii 1.8.16 GraphQL panics on same-named models across worlds → fixed with a small fork patch (client doesn't use GraphQL; SQL/gRPC world-scoped and unaffected). Upstream draft in `deploy/appchain/spike/upstream/`. Worst case remains per-game torii fallback |
| Controller rejects custom chain | M0 gate; cagecalls proves the pattern (`WP_CAGECALLS`); fallback: predeployed accounts for the test env |
| rc.9 + sidecar drift | Digest-pinned images/binaries; cagecalls workarounds ported as code, not lore |
| Public `/sql` | WAF rate limit; revisit for Phase 2 |
| Known dev-account keys (seed 0) | Chain holds no value in Phase 1; fresh operator keys; genesis hardening is Phase 2 |
| Torii DB growth (worlds accumulate) | Periodic planned chain reset while in dev; snapshot + prune strategy decided on chaos day |
| GitHub-download-at-boot (paymaster binary) | Accepted for dev (cagecalls precedent); mirror to S3 if it bites |

## Non-goals (Phase 2+)

Settlement/piltover, mainnet custody/messaging, TEE, entry fees/prizes, eternum mode,
HA sequencer, PR previews.

## References

- `~/cagecalls/devops` — the proven CDK katana/torii pattern (+ ISSUES.md/OPERATIONS.md
  for the failure catalog).
- [cartridge-gg/dungeon-demo](https://github.com/cartridge-gg/dungeon-demo) — Phase 2
  settlement consumer pattern (piltover, L1↔L2 messaging, `katana_settlementStatus`
  gating). The operator side (`cartridge-gg/cartridge-appchain`) is private; public
  pieces are in `dojoengine/katana` (`katana init rollup`, tee-vm releases).
- PRs #4873 / #4864 — prior attempts, moved to draft, to be closed. Kept only as a map of
  the integration surface (deployer, runtime endpoints, client chain config).
