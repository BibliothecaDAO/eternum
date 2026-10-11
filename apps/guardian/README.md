# Guardian Worker

The guardian approves device changes on Realms accounts: it signs
`poseidon('REALMS_DEVICE_CHANGE', chain_id, account, action, device_key, counter)` for the identity Worker and exposes
no public signing operation. Its private key is its only secret. The config ships without routes or a workers.dev
address; identity signs through the `GUARDIAN` service binding. Health is read through identity at `/api/guardian`.

The owner-operated deployment script creates and persists `GUARDIAN_PRIVATE_KEY` once per environment and installs it as
a Worker secret. It must preserve an existing key: replacing it changes the account authority. Neither the key nor its
storage directory belongs in the repository. The guardian must exist before identity’s service binding is installed.

## Checks

The committed config has no public routes and keeps workers.dev off:

```sh
curl -si https://realms-guardian-staging.<account>.workers.dev/ | head -1
```

Every shard's manifest carries the guardian public key and account class that the identity Worker publishes:

```sh
curl -s https://play.dev-realms.party/api/guardian
curl -s <herald>/manifest | jq '{guardianPublicKey, accountClassHash}'
```

Every HTTP path answers 404. Device signing and public-key RPC methods remain available only through service bindings.
