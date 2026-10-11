# First deployment

From the repository root, on the owner's machine:

```sh
pnpm deploy:first dev "$HOME/.realms-dev"
# After reviewing the dry run:
pnpm deploy:first dev "$HOME/.realms-dev" --apply
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
Cloudflare token must be scoped to exactly one account and have Workers, D1, R2, Pages and zone DNS access. The Resend
key needs the environment's verified email sending domain. The one Alchemy URL is also used in the browser build and is
therefore public to players.

`environments.json` is the one dev/production table for this command. Dev uses the reviewed
`deploy/release/staging.json`, SSH alias `realms-dev`, and the existing dev tunnel. Production uses the public
`mainnet.json` asset addresses and requires a reviewed `deploy/release/production.json`, SSH alias `realms-production`
and its own working tunnel/host before first deployment. The command does not format a disk, invent production host
credentials or move a live shard onto an unreviewed endpoint. On a fresh host, run the existing
`deploy/athanor/host/bootstrap.sh` through sudo as its operator after preparing its backup disk and tunnel token;
`OPERATOR` defaults to that sudo user. This infrastructure prerequisite is separate from the five mainnet/shard keys.

The box needs the shared compiler at `~/cairo-suite/tool-data/scarb-install/2.13.1/bin/scarb`, git access to this
repository and Docker Compose. All three release builds run there under `~/cairo-suite/.lock`, cores 8–11. They do not
run on the owner's laptop. No mainnet private key or Alchemy URL goes to that host.

## What the command does

1. Save the inputs in the private directory and check the Alchemy chain and the declared account class.
2. Generate and persist three mainnet account keys and two shard keys. Print the single funding address.
3. Deploy missing accounts and transfer only missing initial relay/monitor reserves.
4. Build the ledger, rating token and collectible release artifacts on the box. Save the public artifacts privately.
5. Declare missing classes and deploy absent contracts at deterministic salts. Dev creates devLords, devChest,
   devCosmetics and the fresh rating token; production reuses its LORDS, rating token and collections. The MMR
   contract's fixed token name is shared with production. Publish only public contract addresses to the environment
   book, retaining the Realms collection and unrelated fields.
6. Read roles, metadata events, presets and season state, and prepare only missing setup calls. Blitz starts at the
   exact requested time, which must still be in the future when setup lands. Production writes public unsigned calls to
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
11. Commit and push **only** the public environment address book to `stack/node-first`. Unrelated staged changes stop
    this step. Print the exact `gh pr merge <number> --merge` command; wait for the owner to merge and rerun.
12. Observe successful push validation on the merged `next` commit. Print the exact `git tag` and `git push` commands
    for the package tag in the release file. Wait for the owner and the `shard-images.yml` release. Never move a tag.
13. Build workspace packages, migrate D1 and deploy all six Workers from the released tree. Worker version tags prove
    the source revision. An interrupted deployment resumes with the remaining Workers.
14. Drain the former shard's directory entry, stop the Compose project occupying its ports, retire that entry and deploy
    the reviewed new shard. Preserve old data and volumes. The existing deployment check proves gameplay and the
    on-chain launcher/ledger-operator handoff before activation. An unrelated container or conflicting new-chain data
    stops the command.
15. Build and publish the client locally with wrangler. Check its chain/RPC, recovery tests, source assets, emitted PWA
    assets, cache rules and published modules/routes. Remove public sourcemaps before upload. Origin, zone and Pages
    project come from the table. A matching remote release is checked without uploading it again.
16. Show both seasons and the deposit, then set missing calendar phases to the exact entered dates. Existing phases are
    preserved. No automatic date is chosen. Leave the process running: it waits for the launch cron and the confirmed
    Frontier game, reads the box's **own `data/native-world.json`**, checks its chain against Herald, and verifies the
    game's start, end, seed and funding terms against the ledger.
17. Mint dev test tokens if needed, approve and fund exactly that game. Production instead writes `cold-funding.json`
    for the cold admin to execute with real LORDS; rerun after its confirmation. An existing deposit is checked and
    never repeated. No chest exists before funding and pool publication.
18. Wait for the relay to publish the exact deposit in the confirmed `LordsBudget`, then verify relay/monitor health and
    the automatically opened Blitz slot. The script never calls `open_slot` manually.

## Private state and recovery

The private directory must be outside the repository, owned by the running user, mode **0700**, with every file mode
**0600**. Symlinks, repository paths and shared modes are refused. Keep a secure offline backup of this directory. Never
paste its contents into a terminal command, issue, log or chat. Do not run the command under a shell tracer.
`--no-env-file` prevents automatic dotenv loading. Subprocess and SDK failures print fixed messages; wrangler file
logging goes to `/dev/null`. Public dates, addresses and step names are the only deployment output.

Rerun the same command and directory after interruption. Chain/Cloudflare/GitHub/box reads are the checkpoints;
transaction intents keep their nonce across lost RPC responses, and deterministic salts keep deployment addresses fixed.
Calls are always recomputed. A saved hash is awaited before any resend. If its receipt is still explicitly absent after
30 one-second retries, the command retries with the same nonce; an unrelated read failure stops it. A successful receipt
is never resent. A confirmed revert permits a new nonce. A changed artifact or constructor is refused after an address
has been pinned. Do not delete private state to retry: that would generate different accounts. Restore its backup. The
process lock prevents two simultaneous runs from sharing an account nonce.

If an unsubmitted season date has passed, edit only the four public date fields in `inputs.json`, review the dry run,
and rerun. A confirmed ledger window or active calendar is not silently replaced. If a production collection or rating
token needs an upgrade, its cold owner must complete the reviewed upgrade first; this command grants no new upgrade
power and never obtains the upgrade key.

Declarations, contract deployments, transfers, successful setup and funding cannot be undone. Check the public book,
roles and four displayed dates before applying. A wrong published contract or immutable preset causes a refusal;
changing private state does not repair it. If the funding game, token, start, end or pool differs, the command refuses
rather than sending another deposit. A proven pool mismatch remains an error. D1 migrations, DNS and release tags also
affect running services: keep the former shard's retained data for recovery and never repoint a published tag.

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

A push to `next` deploys nothing. The Worker and client deploy workflows are deleted. The release image workflow uses
only the built-in `GITHUB_TOKEN`; the deployment command never reads or writes GitHub secrets or environments. GitHub is
used only to read validation/release/merge state and to push the public address book through git.

The owner can delete these stored deployment secrets from repository and environment settings; none has a workflow
reader: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `L2_RPC_URL`, `BETTER_AUTH_SECRET`, `OPERATOR_TOKEN`,
`RESEND_API_KEY`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET`, `CLIENT_SENTRY_DSN`, `LAUNCH_DEPLOYER_PRIVATE_KEY`. If copied by an earlier deployment, also
delete `LEDGER_OPERATOR_PRIVATE_KEY`, `LEDGER_OPERATOR_ADDRESS`, `SHARD_LEDGER_OPERATOR_PRIVATE_KEY`,
`PAUSER_PRIVATE_KEY` and `PAUSER_ACCOUNT_ADDRESS`. Keep the actual Worker secrets in Cloudflare; this is removal of
their unnecessary GitHub copies. The command does not perform these deletions or call `gh secret`.
