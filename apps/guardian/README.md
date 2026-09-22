# Guardian Worker

The guardian approves device changes on Realms accounts: it signs
`poseidon('REALMS_DEVICE_CHANGE', chain_id, account, action, device_key, counter)` for the identity Worker and does
nothing else. Its private key is its only secret. It has no route and no workers.dev address; the identity Worker
reaches it through the `GUARDIAN` service binding.

Only the owner deploys it and sets its key. CI never deploys it. Staging and production each have their own key. The key
is never committed or written to an env file.

## Deploy (owner)

Deploy the guardian before the identity Worker of the same environment; the identity Worker's binding needs it.

```sh
pnpm --dir apps/guardian exec wrangler deploy --env staging
```

Generate the environment's key, store it offline (a lost key cannot approve any new device; a leaked key means a new
account class and new accounts), then paste it at the secret prompt, which does not echo it:

```sh
node -e 'const { ec } = require("./apps/guardian/node_modules/starknet");
  console.log("0x" + Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex"))'
pnpm --dir apps/guardian exec wrangler secret put GUARDIAN_PRIVATE_KEY --env staging
```

For production, use `--env production` in both commands.

## Checks

The Worker answers no public request: its config has no routes, and its workers.dev address is off, so this returns
Cloudflare's 404 rather than anything from the Worker:

```sh
curl -si https://realms-guardian-staging.<account>.workers.dev/ | head -1
```

Every shard's manifest carries the guardian public key and account class that the identity Worker publishes:

```sh
curl -s https://staging.realms.party/api/guardian
curl -s <herald>/manifest | jq '{guardianPublicKey, accountClassHash}'
```
