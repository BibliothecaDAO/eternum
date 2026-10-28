# Rating reads

Ratings are keyed by the L2 wallet that played. `/api/ratings?players=<wallets>` accepts at most 100 wallets and an
optional `block_hash`; `/api/ratings/top?player=<wallet>&limit=<count>` returns the ranking and that wallet's position.
Changing a wallet link cannot retarget a historical game's rating. Account and Realms-id rating queries are refused.

Every request reads token values at one verified L2 block. A named hash is read directly from the provider; latest reads
resolve a confirmed header first. No rating values or rankings are stored in the Worker. Token calls are batched in
groups of at most 100. A persisted budget of 10,000 upstream RPC methods per UTC minute counts chain, header and token
methods across callers. Exhaustion returns 429; missing or partial evidence returns an error, never a cached rating or
an invented initial value. Repeated reads cost fresh RPC calls.

The top list ranks every wallet the environment's rating token has ever updated. The reader learns them from the token's
own `MMRUpdated` events, in ranges of 100,000 blocks from the block where the token was deployed (found once by
searching for its class). It keeps only those wallets and the block (height and hash) they were read through, so each
request reads only the blocks since then. A range whose last block changes hash while its events are read publishes
nothing; if the kept block is later replaced, the wallets are discarded and read again, so a wallet seen only on a
replaced block is never ranked. A range is added only if the chain still holds the kept block once the range is read;
otherwise the wallets are discarded too. While the chain's head is below the kept block the list is refused, until a
block at that height decides. It then reads every wallet's token value at one block and ranks the complete population,
even when only a few leaders are requested. The stored wallets are never a rating value.

Displayed owners may have `profile: {realmsId, name, portrait} | null` from their current verified wallet link. Names
and portraits are presentation metadata; they never select the rating wallet. An unlinked owner remains an address.

## Environment L2

The environment address book (`contracts/common/addresses/dev.json` or `mainnet.json`) supplies the L2 chain. Wallet
proofs, Realm ownership and rating reads use that chain and `L2_RPC_URL`, which must be its HTTPS Alchemy endpoint;
redirects are refused. The Worker checks the provider's chain before reading contracts. A missing or invalid setting
fails environment initialization, and a proof naming another chain is refused before signature verification or nonce
consumption. Deployed accounts retain contract verification; offchain verification still requires confirmed absence and
allow-listed deployment data.

The Realms collection and rating token come from `contracts/common/addresses/dev.json` or `mainnet.json`, selected by
`ENVIRONMENT`, like the ledger. Both environments run on mainnet. Staging uses `dev.json`: its own ledger, test token,
rating token and collections, and the real Realms collection. Production uses `mainnet.json`. No missing dev address
falls back to production. Realm holdings have one reader, `server/realm-holdings.ts`, reached by the relay through the
private `ValueIdentity.holdsRealm` and `heldRealms` bindings. It asks the marketplace indexer (`MARKETPLACE_API_URL`)
first; a holder check the indexer does not confirm is decided by a live `owner_of`, so indexer lag never refuses a
holder, and a check neither source answers is a retry, not a refusal. The wallet's Realm list has no chain fallback.
Rating readers live in separate Worker deployments; every token lookup selects the environment book directly.

The client and Workers share the address book through `environmentL2`. The deployment workflow does not override its
chain or ledger. The single `L2_RPC_URL` secret serves the Worker and the browser build. Discord is offered only when
both optional credentials are configured; email code sign-in uses the required Resend key. The deployment script
supplies the required generated VAPID pair; the push contact, notifier interval and account class are code constants.
Operators configure and deploy the environment.
