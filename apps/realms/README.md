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
proofs, Realm ownership and chat slot reads go to the marketplace's RPC relay (`MARKETPLACE_API_URL` + `/rpc`, the
provider the marketplace uses) and to `L2_RPC_URL`, which must be the chain's HTTPS Alchemy endpoint, when the relay
does not carry the chain's answer (down, slow, rate limited, or an unsupported method). Rating reads scan events, which
the relay does not serve, so they use `L2_RPC_URL` only. Redirects are refused. The Worker checks the provider's chain
before reading contracts. A missing or invalid setting fails environment initialization, and a proof naming another
chain is refused before signature verification or nonce consumption. Deployed accounts retain contract verification;
offchain verification still requires confirmed absence and allow-listed deployment data.

The Realms collection and rating token come from `contracts/common/addresses/dev.json` or `mainnet.json`, selected by
`ENVIRONMENT`, like the ledger. Both environments run on mainnet. Staging uses `dev.json`: its own ledger, test token,
rating token and collections, and the real Realms collection. Production uses `mainnet.json`. No missing dev address
falls back to production. Realm holdings have one reader, `server/realm-holdings.ts`, reached by the relay through the
private `ValueIdentity.holdsRealm` and `heldRealms` bindings. A holder check, which grants the Realm, is the chain's
live `owner_of` only, so a sale the marketplace index has not seen yet never credits the seller; a check the chain does
not answer is a retry, not a refusal. The wallet's Realm list for the picker comes from the marketplace index
(`MARKETPLACE_API_URL`) and has no chain fallback. Rating readers live in separate Worker deployments; every token
lookup selects the environment book directly.

The client and Workers share the address book through `environmentL2`. The deployment workflow does not override its
chain or ledger. The single `L2_RPC_URL` secret serves the Worker and the browser build. Each sign-in provider (Google,
Apple, Discord, X) is offered only when both its credentials are configured, and one set alone fails the environment;
email code sign-in uses the required Resend key. The deployment script supplies the required generated VAPID pair; the
push contact, notifier interval and account class are code constants. Operators configure and deploy the environment.

## Campaign tickets and founded free homes

Players open `/join/devcon/<code>`, sign in, and redeem through `/api/campaigns/redeem`. A free home can receive its
first source after founding: a campaign ticket or a held Realm. A home with a source cannot switch. The relay's
`/api/value/realm-entry` verifies the held NFT or reads the ticket and uses the existing contract entrypoint. A player
returns to game entry → Choose a daily claim → Add this daily claim. The founding picker shows the ticket and held
Realms together, marks used Realms as taken, and submits only the player’s confirmed choice. Tickets are one per
account. Registration preserves the home's identity, traits and prior daily grants. The existing daily action pays that
source's reward. A late NFT grants the normal held-Realm Labor, without Essence or missed-days compensation.

Production recovery starts with one account, after the owner's production go and the compatible release and services are
deployed:

1. Select one account from the approved 22-account file whose free home has at least one unclaimed game day before
   today. Save a confirmed Herald snapshot and calculate its expected missed-day grants from the home's founding
   timestamp, the game's day calendar, prior `LaborGrant` rows and the ticket tier drawn in the next step.
2. For that account only, send authenticated operator POSTs to `/api/operator/campaign-draw` with
   `{ campaign: "devcon-2026", realmsId }`, then `/api/value/operator/campaign-entry` with
   `{ chainId, gameId, realmsId }`. Keep credentials, account identifiers and responses in private files. Do not start
   the bulk command yet.
3. Wait for confirmed Herald indexing. Check that the same home gained the expected source and one `LaborGrant` for each
   previously unclaimed day through yesterday. Check exact tier amounts, allowing Labor's existing storage cap and
   accrued production; Essence must show the full nonzero catch-up. Today's grant must remain untouched. Compare the
   snapshots for unexpected changes to other homes. If any amount or row differs, stop before the other accounts.
4. Once the first account's grant is verified, run the command below with the same original 22-account file and the
   approved production origin, chain and game. It safely retries the first account without paying again, then recovers
   the other 21. Verify the final counts and Herald grants; reruns retain each ticket and never duplicate grants.

For that bulk step, run from the repository root (replace the illustrated dev target with the approved target):

```sh
OPERATOR_TOKEN_FILE=/private/operator-token pnpm --dir apps/realms campaign-founded-homes \
  /private/affected.json https://play.dev-realms.party CHAIN_ID GAME_ID devcon-2026
```

The command selects exactly 22 distinct `home: "free"` accounts. It draws each ticket from D1 through the authenticated
`/api/operator/campaign-draw`, then registers it through `/api/value/operator/campaign-entry`. It prints counts only. A
retry retains the original ticket and repeats registration safely, including after interruption between the steps. These
routes reuse the existing draw, eligibility and relay registration paths; their cost is two operator handlers and the
recovery script, allowing recovery without player impersonation or exporting the relay signing key. Production execution
requires separate approval. The compatible contract release and both Workers must be deployed first.

Only the operator recovery route sets the Devcon recovery attestation in existing entitlement metadata. It compensates
unclaimed game days from founding through yesterday, through the normal capped Labor and uncapped Essence grant. Today's
claim stays separate. Exact retries pay nothing again, and recovery can finish if ordinary registration landed between
the draw and recovery. The contract verifies the attestation and home state; the script supplies the incident's approved
account list. Ordinary late redemption and late NFT attachment carry no compensation attestation.

Service behavior is checked with `pnpm --dir apps/realms test server/identity.test.ts` and
`pnpm --dir apps/value-relay test src/realm-entry.test.ts src/worker-jobs.test.ts`. Live release preservation and claim
payment additionally require the three-snapshot dev rehearsal recorded in the change's report.
