# Setup, deploy, season and teardown

From the repository root, on the owner's machine:

```sh
pnpm run setup dev "$HOME/.realms-dev"
# After reviewing the dry run:
pnpm run setup dev "$HOME/.realms-dev" --apply
```

Use `production` and a different private directory for production. **Without `--apply`, the command only reads.** It
creates no directory, key, contract, secret, release, calendar or transaction. It reports missing prerequisites rather
than guessing their values. A fresh dry run cannot inspect Alchemy or Cloudflare until their credentials have been
entered; it reports those steps as unavailable. Later dry runs use the saved credentials and inspect remote results.

The first apply asks for the Cloudflare token, one Alchemy mainnet URL, the Resend key, the whole-token Frontier
deposit, and four UTC dates: Frontier start/end and Blitz start/end. Dates use `YYYY-MM-DDTHH:MM:SSZ`; none has a
default. The Frontier start must be on its army tick and its duration must contain whole day bags. An invalid end prints
its two nearest valid alternatives without changing it. All four dates and the deposit are shown before transactions.
Production additionally asks for the **public** cold-admin and treasury addresses. It never asks for their keys.

The first account step prints one deployer address to fund with about **250 STRK**, then stops. Run the same apply
command after funding it. The command deploys that account, transfers 30 STRK to the relay and 1 STRK to the monitor,
and deploys them. The owner funds only the deployer. The keys remain separate: the deployer/admin key stays on the owner
machine; the relay and monitor receive only their own keys. Shard launcher and shard relay keys are separate from these
mainnet keys and need no STRK.

The 250 STRK is a reserve, not a quote: the earlier dev deployment measurement was about 84 STRK, with roughly 171 STRK
of transaction resource bounds; 200 was reserved for deployment and first funding, 30 for the measured relay day, and 1
for the monitor. The remaining 19 covers unmeasured account deployment fees and variation. Transactions use the SDK's
current fee estimation and resource bounds. Production reuses assets and has different costs. No fee measurement has
been made for these new accounts or the revised reward contracts.

## Before running

Install Bun 1.4, Node 22, pnpm 10.25, git, GitHub CLI and SSH. Install the repository's locked dependencies.
Authenticate `gh` with repository and Actions read permissions (plus permission to push the public address book). The
Cloudflare token must be scoped to exactly one account. Required permissions: Account — Workers Scripts edit, D1 edit,
Pages edit, Workers R2 Storage edit; Zone for the environment's zone — Zone read, DNS edit, Workers Routes edit, Cache
Rules edit (shown as 'Cache Settings' in the token screen). Enable R2 on the account once. Prerequisites read D1, Pages,
R2, the zone, Workers scripts and the zone’s rulesets list before any STRK is spent; these reads cannot verify write
permissions. Refusals name the resource family, HTTP status and numeric Cloudflare codes, never the response text. The
Resend key needs the environment's verified email sending domain. The one Alchemy URL is also used in the browser build
and is therefore public to players.

`environments.json` is the one dev/production table for this command. Dev uses the reviewed
`deploy/release/staging.json`, SSH alias `realms-dev`, and the existing dev tunnel. Production uses the public
`mainnet.json` asset addresses and requires a reviewed `deploy/release/production.json`, SSH alias `realms-production`
and its own working tunnel/host before first deployment. The command does not format a disk, invent production host
credentials or move a live shard onto an unreviewed endpoint. On a fresh host, run the existing
`deploy/athanor/host/bootstrap.sh` through sudo as its operator after preparing its backup disk and tunnel token;
`OPERATOR` defaults to that sudo user. This infrastructure prerequisite is separate from the five mainnet/shard keys.

The box needs git access to this repository, Docker Buildx and Compose. Image builds install their pinned compiler.
Contract builds run there under `~/cairo-suite/.lock`, cores 8–11. They do not run on the owner's laptop. No mainnet
private key or Alchemy URL goes to that host.

Deployment uses the checked-out commit, exporting committed files so unrelated working-tree edits do not enter a build.
Its HEAD is the only deployment revision: dev requires it pushed to any origin branch; production requires it on
`origin/next` with green push validation. Workers, shard images and Pages all use that commit. Push a dev fix and rerun;
for production, merge it, wait for validation, check out that commit and rerun. No tag, release package or private
revision edit is needed. The box exports committed files, builds init, Herald and metrics, and records local image
digests and contract facts in `release.json`. Cairo runs under `~/cairo-suite/.lock` on cores 8–11. Contract source,
lockfiles and compiler versions key Docker's Cairo layers; changes to Herald or deployment scripts reuse them.

## What the command does

1. Save the inputs in the private directory and check the Alchemy chain and the declared account class.
2. Generate and persist three mainnet account keys and two shard keys. Print the single funding address.
3. Deploy missing accounts and transfer only missing initial relay/monitor reserves.
4. Build the ledger, rating token and collectible release artifacts on the box. Save the public artifacts privately.
5. Declare missing classes and deploy absent contracts at deterministic salts. Dev creates devLords, devChest,
   devCosmetics and the fresh rating token; production reuses its LORDS, rating token and collections. The MMR
   contract's fixed token name is shared with production. Publish only public contract addresses to the environment
   book, retaining the Realms collection and unrelated fields.
6. Read roles, metadata events, presets and season state, and prepare only missing setup calls. Metadata scans begin at
   each collection’s deployment block, found from historical class reads once per collection per run. Presence reads run
   in parallel during both inspection and apply. Opening a new Blitz ledger season requires its start to be in the
   future; an existing matching season is preserved after its start. Production writes public unsigned calls to
   `cold-setup.json` and waits for the cold wallet to execute them. Its cold key never enters the command.
7. Adopt the box's protected operator token if present. Generate the other service credentials once. If the guardian
   Worker already holds `GUARDIAN_PRIVATE_KEY`, keep it even if this directory has no copy. Never rotate it.
8. Create missing D1 databases, the status R2 bucket, Pages project and domain. Refuse conflicting existing DNS.
   First-install Worker placeholders have no routes and return 503; their named entrypoints break the binding cycle.
   Existing Workers are preserved until their actual deployment step.
9. Deliver each Worker's generated secrets directly to that Worker on standard input. An existing secret name alone
   cannot prove its value: local upload fingerprints plus remote names determine which uploads need repeating. Guardian
   is the exception: its existing key is always preserved. Nothing is uploaded to GitHub. The deployer and cold keys
   stay on the owner's machine.
10. Install the operator token on the box if absent. Its protected file is checked against the saved environment token.
11. If the address book changed, commit and push **only** that file on the owner's current branch, then stop. Create a
    branch first if the checkout is detached or on `next`. Rerun from the new pushed commit; production requires merging
    it to `next` and successful push validation first. Unrelated staged changes stop publication.

## Deploy

After setup, the box and Cloudflare halves can run independently from the same pushed commit:

```sh
pnpm run deploy dev
pnpm run deploy:cloudflare dev "$HOME/.realms-dev"
```

The box command needs SSH alone. It builds images on the target box, initializes the shard and registers it. Full
output, including builds and failures, stays in a mode-0600 `deploy-*.log` in the run directory; the command prints its
path, failing stage, HTTP status and fixed service error. Deployment holds the box's stack lock.

The Cloudflare command belongs to the credential holder. It exports HEAD to a temporary directory, installs locked
dependencies, builds workspace packages, migrates D1 and publishes Workers, then builds and publishes the client.
Neither deploy command has a dry run or performs funding or calendar operations. Production, when commissioned, builds
its images on its own box from the same source commit.

## Season

```sh
pnpm run season dev "$HOME/.realms-dev"
```

This reads the existing private directory without migration: `inputs.json`, `keys.json` and `secrets.json`. It sets the
missing calendar phases from the saved dates, preserves and displays existing published phases, waits for the launch
cron's Frontier game, deposits the saved whole-LORDS amount, then watches pool publication and the automatic Blitz slot.
It uses the public address book written by setup. An existing deposit is verified rather than repeated. Mainnet funding
remains an owner operation, including dev funding.

The dev box can open the free Frontier phase at the current armies tick, for one complete bag of days:

```sh
python3 deploy/athanor/scripts/operator-command.py season dev
```

This uses the deployed preset and the protected operator credential. It preserves an already running phase and makes no
mainnet transaction. Run the existing harness after deployment and report its result separately from deployment:

```sh
python3 deploy/athanor/scripts/operator-command.py measure /opt/athanor/runs/staging-h check --cpuset 20-23 -- \
  --game-type frontier --preset 2 --bots 2 --minutes 2 --interval-seconds 15 --setup-concurrency 2
```

When the launch Worker has created the game, add its `--game-id` to play that game. Funding, paid Blitz registration and
payouts require the owner. The gameplay report never controls shard admission.

## Teardown

```sh
pnpm run teardown dev
```

Only dev is accepted. The box retires its directory row, stops its Compose project, removes its volumes and run
directory, and preserves deployment logs in `/opt/athanor/logs`. It leaves Cloudflare and the mainnet ledger alone.
Teardown output has its own mode-0600 log there. The next deployment creates a fresh shard with a new chain identity so
service cursors cannot follow the former chain. A restart reads the existing chain identity from the run directory.

## Private state and recovery

The private directory must be outside the repository, owned by the running user, mode **0700**, with every file mode
**0600**. Symlinks, repository paths and shared modes are refused. Keep a secure offline backup of this directory. Never
paste its contents into a terminal command, issue, log or chat. Do not run the command under a shell tracer.
`--no-env-file` prevents automatic dotenv loading. Subprocess failures preserve their output in a private log and print
its path; wrangler file logging goes to `/dev/null`, and the Starknet library logger is disabled at startup. Public
dates, addresses, step names and fixed progress messages are the only deployment output. Each inspection is announced,
including dry runs; metadata reads and transaction-confirmation waits announce themselves before waiting. No timer or
spinner runs.

Rerun the same command and directory after interruption. Chain/Cloudflare/GitHub/box reads are the checkpoints;
transaction intents keep their nonce across lost RPC responses, and deterministic salts keep deployment addresses fixed.
Calls are always recomputed. A saved hash is awaited before any resend. If its receipt is still explicitly absent after
30 one-second retries, the command retries with the same nonce; an unrelated read failure stops it. A successful receipt
is never resent. Normal confirmation waits require acceptance on L2 or L1, not pre-confirmation. If recovery finds only
a pre-confirmed receipt after its bounded wait, it stops as pending without resending. A confirmed revert permits a new
nonce. A changed artifact or constructor is refused after an address has been pinned. Do not delete private state to
retry: that would generate different accounts. Restore its backup. The process lock prevents two simultaneous runs from
sharing an account nonce.

If a calendar phase's start has passed but its end is still in the future, rerun with the same dates. An already-open
Blitz ledger season keeps its dates; only a new ledger season requires a future start. For future seasons, edit the four
dates and the Frontier deposit in `inputs.json`, run setup to open the next ledger season, then run season. After the
previous seasons end, the ledger opens the next Blitz season number and the calendar replaces its ended phases. Running
or future seasons are never replaced. Existing deposits are never changed. If a production collection or rating token
needs an upgrade, its cold owner must complete the reviewed upgrade first; this command grants no new upgrade power and
never obtains the upgrade key.

Declarations, contract deployments, transfers, successful setup and funding cannot be undone. Check the public book,
roles and four displayed dates before applying. A wrong published contract or immutable preset causes a refusal;
changing private state does not repair it. If the funding game, token, start, end or pool differs, the command refuses
rather than sending another deposit. A proven pool mismatch remains an error. D1 migrations and DNS also affect running
services: keep the former active shard’s retained data for recovery.

Dev chest metadata uses the public test CID already committed in
`contracts/l2/collectibles/ext/scripts/deployment/data/example.json`. All five chest bands and the test cosmetics use
that sample; the owner supplies no picture URLs. Production metadata stays with its existing collections. The account
class is the OpenZeppelin v0.17 class documented by
[Starknet.js](https://starknet-js.com/docs/guides/account/create_account/); the command verifies its declaration on
`SN_MAIN` before generating keys or requesting funding.

Tests use deterministic throwaway keys and mocked RPC, subprocess and Cloudflare responses. They send no mainnet
transaction and read no live private key:

```sh
pnpm test:deployment
python3 -m unittest discover -s deploy/athanor/scripts -p 'test_*.py'
```

## Remove unused GitHub secrets

A push to `next` deploys nothing. No workflow publishes images, Workers or the client. The deployment command never
reads or writes GitHub secrets or environments. GitHub holds source commits and production validation results only.

The owner can delete these stored deployment secrets from repository and environment settings; none has a workflow
reader: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `L2_RPC_URL`, `BETTER_AUTH_SECRET`, `OPERATOR_TOKEN`,
`RESEND_API_KEY`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET`, `CLIENT_SENTRY_DSN`, `LAUNCH_DEPLOYER_PRIVATE_KEY`. If copied by an earlier deployment, also
delete `LEDGER_OPERATOR_PRIVATE_KEY`, `LEDGER_OPERATOR_ADDRESS`, `SHARD_LEDGER_OPERATOR_PRIVATE_KEY`,
`PAUSER_PRIVATE_KEY` and `PAUSER_ACCOUNT_ADDRESS`. Keep the actual Worker secrets in Cloudflare; this is removal of
their unnecessary GitHub copies. The command does not perform these deletions or call `gh secret`.
