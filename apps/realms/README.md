# Rating reads

Ratings are keyed by the L2 wallet that played. `/api/ratings?players=<wallets>` accepts at most 100 wallets and an
optional `block_hash`; `/api/ratings/top?player=<wallet>&limit=<count>` returns the ranking and that wallet's position.
Changing a wallet link cannot retarget a historical game's rating. Account and Realms-id rating queries are refused.

Every request reads token values at one verified L2 block. A named hash is read directly from the provider; latest reads
resolve a confirmed header first. No rating values or rankings are stored in the Worker. Token calls are batched in
groups of at most 100. A persisted budget of 10,000 upstream RPC methods per UTC minute counts chain, header and token
methods across callers. Exhaustion returns 429; missing or partial evidence returns an error, never a cached rating or
an invented initial value. Repeated reads cost fresh RPC calls.

The top list enumerates holders from the existing immutable `starknet_mmr_updates` history and its atomic
`airfoil.checkpoints` watermark through the portal's `/api/ratings/population` GET. It reads every holder's token value
at that named hash and ranks the complete population, even when only a few leaders are requested. SQL supplies
population and history, never a second rating value. There is no new history table or credential.

Displayed owners may have `profile: {realmsId, name, portrait} | null` from their current verified wallet link. Names
and portraits are presentation metadata; they never select the rating wallet. An unlinked owner remains an address.

## Environment L2

The environment address book (`contracts/common/addresses/<network>.json`) supplies the L2 chain. Wallet proofs, Realm
ownership and rating reads use that chain and `IDENTITY_RPC_URL`, which must be its HTTPS Alchemy endpoint; redirects
are refused. The Worker checks the provider's chain before reading contracts. A missing or invalid setting fails
environment initialization, and a proof naming another chain is refused before signature verification or nonce
consumption. Deployed accounts retain contract verification; offchain verification still requires confirmed absence and
allow-listed deployment data.

`REALMS_ADDRESS`, `RATING_TOKEN_ADDRESS` and `RATING_HISTORY_URL` name this environment's collections and indexed
population. No mainnet address or population source is inferred for staging. Labor ownership runs through the private
`ValueIdentity.realmOwnerOf` service binding; the relay's second Realms RPC is removed. Rating readers are named by the
configured chain, so staging cannot use the mainnet reader.

The client and Workers share the address book through `environmentL2`. The deployment workflow does not override its
chain or ledger. The existing `CLIENT_IDENTITY_RPC_URL` secret maps to `IDENTITY_RPC_URL`. It checks the public
contract/history settings before migrations or secret writes. This is repository wiring only; operators configure and
deploy the environment.
