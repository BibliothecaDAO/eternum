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

## Shared links

A player's post of a moment (today, a Frontier day from its day-done card) carries the player's own link for that
moment, `/s/<code>` (`@realms-world/identity`'s `SHARE_KINDS` and `sharePath`). `POST /api/shares` makes it once per
player, kind, game and moment and hands back the same code after; `POST /api/shares/<code>/posted` records that the
player opened the post. The landing posts `/api/shares/<code>/visit` (public, on the per-client budget), which keeps the
browser's first visit under its browser id (the same cookie the referral check reads, given at the visit when the
browser has none), with the tag the link carried (`{ via }`, the link's own `?via=`: `x` from Post on X, `system` from a
phone's Share), and answers who shared which moment.

Sign-up reports nothing of its own. Settlement gives each account made after one of its browsers opened another player's
link to the first such link (first touch), never to the sharer's own accounts or any account on a browser the sharer was
signed in on, joined when the account was made. A join counts as activated once the account's homes hold `FRIEND_GLORY`
Glory in the link's game, as its Herald's `RaceMember` rows say; a pre-season Aspect invite (no game) counts in the
listed shard's open Frontier games, the first to reach it deciding. Only games that have not ended settle. A Herald that
cannot answer leaves its joins for the next read. A sharer's tally read settles that sharer's joins; the operator's
report and the minute cron settle every join.

An Aspect invite pays its sharer in the friend's game: `FRIEND_FRAGMENTS` for each of the first `FRIENDS_LIMIT` friends,
and `FRIENDS_BONUS_FRAGMENTS` more at the last of them (all in `packages/types/src/constants/shop.ts`). A friend on the
sharer's mailbox, or on one an already paid friend has, activates but pays nothing (one person counts once). Each payout
is a `share_payouts` row whose id is the credit's id on chain; settlement sends unpaid rows to the relay's
`/api/value/operator/fragments`, which calls `credit_fragments`, and marks a row paid once the relay accepts it. A
refused or lost delivery is retried on the next settle, and the chain pays an id once. A visit from the sharer's own
browsers is never counted. A friend who opens the link in one browser (X's in-app browser) and signs up in another is
not the link's: the browser id is the only tie.

The link unfurls as its own. The Worker also takes the app's `/s/*` route. It serves the page the host serves, with its
title, description and address saying who shared which moment (`SHARED_MOMENT_WORDS`), and its `og:image` and
`twitter:image` naming the link's card once the sharer published one. The share sheet makes the card into a JPEG on the
device as it opens and publishes it (`PUT /api/shares/<code>/card`, the sharer only, at most 1 MB) only when the player
presses Post on X or Share; a sheet closed without that press publishes nothing. The card is kept in R2 (`SHARE_CARDS`,
the environment's `shareCardBucket`, which setup creates) and served at `GET /api/shares/<code>/card` while its link
exists (a deleted account's links cascade, and its card is then refused whatever R2 holds), with a one-day public cache.
Publishing again replaces it. Until the card is kept, or for a code no link has, the page's own preview stands. A
crawler that read the link before its card landed holds the game's preview for as long as it caches the unfurl.

What a link exposes to anyone holding it: the sharer's current public name and the day (page title, landing, visit
answer), and once published the card's pixels (name, portrait, day, closing rank and move, up to 18 fight and find marks
and the six day totals). No map position, email, wallet address, key or event time. The code is unlisted, not an access
control.

- `GET /api/shares` (signed in): the account's
  `{links, posted, visits, joined, activated, friendsPaid, fragmentsEarned}`, its joins settled first; the minute cron
  delivers the payouts they earn.
- `GET /api/operator/shares` (operator token): every moment's funnel (`moments`: kind, chain, game, moment and its
  counts), first visits from others' browsers by the tag their link carried (`firstVisitsByTag`: `x`, `system`, and null
  for none), the sharers who brought the most (`topSharers`, `TOP_SHARERS` in `server/shares.ts`), `settledAt` and
  `unsettledJoins`, the joins whose Herald could not answer. A tag names the button that made the link, not the app that
  carried it, and posts are not counted per tag, so visits by tag are not a rate per post.

```bash
curl -s -H "authorization: Bearer $OPERATOR_TOKEN" https://<identity origin>/api/operator/shares | jq '.moments[:7]'
```

## Free Ancient Seal codes

One command, `pnpm --dir apps/realms seal-codes`, issues a batch of free Ancient Seal codes and loads them into an
environment's database; run without arguments, it prints its usage. It writes the printed codes to `<out>/codes.txt`
(readable by you only) and their hashes to `<out>/codes.sql`, then loads that file with
`wrangler d1 execute DB --remote --env <environment>` (your Cloudflare login). The same seed and label give the same
codes, and a code already loaded is left as it is, so the command is safe to run again after a failure. A player redeems
one code per account in the shop (`POST /api/seal-code`); the Seal reaches every Frontier game the account entered,
through the relay, and a game entered later grants it on entry.

## Fragments paid in LORDS

`GET /api/shop/fragments?chain&game&fragments=N` quotes N Fragments (a cent each, priced in LORDS by AVNU, rounded up to
5 LORDS) as one transfer of the environment's LORDS to its treasury, both read from `contracts/common/addresses/`, held
for ten minutes; an account buys at most `FRAGMENTS_A_DAY` a day. The player sends the transfer, then
`POST /api/shop/fragments/pay {quoteId, transactionHash}`: identity reads the receipt on the environment's L2, counts
the transfers of that token from the account's default or linked wallet to the treasury, records the payment in
`store_receipts` as `lords:<transaction>` and delivers the Fragments to the quote's game through the relay
(`credit_fragments`, the receipt as its id), so a retry pays once. The minute cron finishes what a request left open. A
payment that reverted or that no wallet of the account sent is refused; one below the quote, after the quote expired or
past the daily limit is kept for a refund. A wallet's transfer pays one quote, whenever it was sent. The operator pays
each refund by hand from the list, then records the transfer that paid it, which takes it off the list; recording the
same transfer again changes nothing, and another transfer for a refund already recorded is refused:

```bash
curl -s -H "authorization: Bearer $OPERATOR_TOKEN" https://<identity origin>/api/operator/shop/refunds | jq '.refunds'
curl -s -H "authorization: Bearer $OPERATOR_TOKEN" https://<identity origin>/api/operator/shop/refunds \
  -d '{"transactionHash":"<the payment>","refundTransaction":"<the transfer that refunded it>"}'
```
