# Realms self-hosted appchain (dev)

Everything runs in AWS account `061906581174` (us-east-1) on **one EC2 box**
(m7a.xlarge, Elastic IP `52.54.98.119`), fronted by Cloudflare on `jcndata.com`:

| Endpoint | What |
| --- | --- |
| `https://katana.jcndata.com` | Katana sequencer (docker, instant mining + 30 s idle heartbeat) |
| `https://torii.jcndata.com` | Torii for the blitz world (docker, host port 8081) |
| `https://torii-eternum.jcndata.com` | Torii for the eternum world (docker, host port 8082) |
| `https://play.jcndata.com` | Tester client (S3 + Cloudflare) |
| `http://52.54.98.119` / `:8081` / `:8082` | Direct access for scripts/CLI (Cloudflare blocks non-browser UAs on the https names) |

The box runs katana + heartbeat + torii-s2 + torii-eternum in docker plus
nginx routing `:80` by Host header (Cloudflare Flexible mode). Chain data
AND torii DBs live on a RETAIN EBS volume mounted at `/data` — resizes,
instance replacements and config rolls keep both the chain and the indexes.

Two persistent worlds share the katana. Games are **rows keyed by `game_id`**
inside a world (GameRegistry), not separate deployments:

- Blitz (`s2` namespace): `0x78ff85ac450bb559c97966b64666fd5292f4a98756a607349d9f93f4563bdd2`
- Eternum (`s1_eternum` namespace): `0x2c3d2792f28e27eea7bf500ed8bb6c0b78b4a6cb83d46df79f4e10faf84453f`

## Common operations

**Deploy the client** (builds from the committed `apps/game/.env.production`):

```bash
gh workflow run deploy-client.yml --ref <branch> -f version=<label>
```

**Launch a game**: use the factory UI in the client (`/factory`), which dispatches
`game-launch.yml` through the launch-service Lambda. CLI fallback: `config/deployer/clean/launch-step.ts`
(see `scripts/README.md`).

**Register a balance preset** (presets are immutable on-chain; **always pass the profile** — the
stored config is the raw base sheet and profiles are otherwise only applied at game creation):

```bash
bun config/deployer/clean/registrar/register-preset.ts --preset-id <n> --balance-profile official-60
```

Live presets: **6** = Regular Fast (official-60, default), **7** = Duel (official-90).
2/3 (dev balance) and 4/5 (registered without profiles) are retired.

**Change torii config**: edit the SSM parameter `/realms-appchain/dev/torii-{s2,eternum}-config`
(template in `torii-s2/`), then run the on-box refresh (fetches SSM, forces `rpc` to the local
katana, restarts the container — DBs persist, so this takes seconds, no reindex):

```bash
aws ssm send-command --instance-ids <katana-instance-id> \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["/usr/local/bin/torii-refresh s2"]'
```

To force a reindex from block 0, bump the `db_dir` version in the SSM config
(e.g. `/data/torii-db-v2`) before refreshing.

**Katana instance**: instance-type changes are stop/start in place — chain and indexes survive.
A **userData change replaces the instance**: stop the old instance AND `detach-volume` the `/data`
volume first, or the new instance's attach fails and CFN rolls back messily. The Elastic IP
follows the replacement, so DNS never changes.

## Layout

- `cdk/` — infrastructure as code (foundation / DNS / dev stacks). See `cdk/README.md`.
- `scripts/` — world bootstrap + deployment scripts. See `scripts/README.md`.
- `torii-s2/` — torii config template + renderer. See `torii-s2/README.md`.
- `spike/` — the original local docker-compose spike (reference).

Contract deploys pin `world_address` in the `appchain` profile TOMLs and require
`ASDF_SOZO_VERSION=1.8.7` (katana serves RPC 0.10.0). Never remove the pins: class hashes are not
reproducible across build environments, and an unpinned migrate can deploy a stray world.
