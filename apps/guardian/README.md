# Guardian Worker

The guardian approves device changes on Realms accounts: it signs
`poseidon('REALMS_DEVICE_CHANGE', chain_id, account, action, device_key, counter)` for the identity Worker and does
exposes no public signing operation. Its private key is its only secret. The config ships without routes or a
workers.dev address; identity signs through the `GUARDIAN` service binding. The owner may attach the readonly health
hostname described below.

Only the owner deploys it and sets its key. CI never deploys it. Staging and production each have their own key. The key
is never committed or written to an env file.

## Deploy (owner)

Deploy the guardian before the identity Worker of the same environment; the identity Worker's binding needs it.

```sh
pnpm --dir apps/guardian exec wrangler deploy --env staging
```

Generate the environment's key straight into a file on offline storage (a lost key cannot approve any new device; a
leaked key means a new account class and new accounts), then feed that file to the secret. The key never reaches the
terminal or the shell history:

```sh
umask 077
node -e 'const { ec } = require("./apps/guardian/node_modules/starknet");
  process.stdout.write("0x" + Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex"))' \
  > /media/offline/guardian-staging.key
pnpm --dir apps/guardian exec wrangler secret put GUARDIAN_PRIVATE_KEY --env staging < /media/offline/guardian-staging.key
```

For production, use `--env production` and its own key file.

## Checks

The committed config has no public routes and keeps workers.dev off, so this address returns Cloudflare's 404 even when
the owner has attached a separate readonly health hostname:

```sh
curl -si https://realms-guardian-staging.<account>.workers.dev/ | head -1
```

Every shard's manifest carries the guardian public key and account class that the identity Worker publishes:

```sh
curl -s https://play.dev-realms.party/api/guardian
curl -s <herald>/manifest | jq '{guardianPublicKey, accountClassHash}'
```

GET /health can be served on a public hostname attached by the owner for independent monitoring. It returns public key
readiness with no-store; every other HTTP path and every POST still answers 404. Device signing and public-key RPC
methods remain available only through service bindings. No public route or deployment is created by this code.
