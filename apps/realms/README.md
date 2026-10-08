# Rating reads and their operating cost

The identity Worker serves one mainnet token rating fact. `RatingReader` shares immutable values and a full ranking by
block hash across callers and isolates. Its SQLite cache keeps 32 recent snapshots and survives a restart. There is no
mutable current-rating table. D1 identity/wallet resolution happens outside that cache, so a link change does not freeze
the reader's identity. An explicit `block_hash` reads a retained snapshot; unknown/evicted hashes return 503 without
requesting arbitrary historical blocks from the paid RPC.

Token reads use Starknet RPC 0.9 read methods over JSON-RPC 2.0, batches of at most 100 and no scalar fallback if the
provider rejects a batch. The provider must support this read surface and batch size. A persisted limit of 10,000
upstream RPC methods per UTC minute is shared by all IPs. Cached pinned responses work without that budget. Exhaustion
returns 429 `ratings_budget_exhausted`; incomplete data is never a partial ranking. The budget counts methods, including
chain and header reads, rather than treating a 100-method HTTP batch as one billed operation. Provider
compute-unit/dollar pricing has not been measured.

Population comes from the indexer's existing `starknet_mmr_updates` and its atomic `airfoil.checkpoints` watermark. The
portal already owns that Postgres connection and exposes `/api/ratings/population`: HEAD returns watermark headers; GET
returns the holder set at that same statement's watermark. The Worker copies no database credential or rating value from
SQL. Warm top reads use only HEAD and the cached ranking; a new watermark uses GET once and reads values from the token
at the named hash. Deploy the portal route and corrected existing MMR indexer before enabling the top read. The MMR feed
advances the watermark on empty confirmed blocks, and its insert-only rollback identity is the transaction hash: every
inserted event in a reverted transaction is removed together. No new Postgres table/migration.

Costs below count upstream mainnet HTTP requests / RPC methods. P is the former event-page count and N is the total
indexed holder count (top 20 still ranks against everyone). The before counts were measured against the pre-fix reader.

| Read          | Before cold or repeated | After cold object/snapshot | After warm same hash     |
| ------------- | ----------------------- | -------------------------- | ------------------------ |
| 24-seat lobby | 26 /26                  | 2 /26                      | latest:1 /1; pinned:0 /0 |
| top 20        | N+P+2 /N+P+2            | 1+ceil(N/100) /N+2         | 0 /0                     |

After the object has verified mainnet, another cold snapshot saves that one chain-check method. Top cold adds two portal
SQL requests (HEAD, GET); warm adds one cheap watermark read (HEAD), with no history scan or paid token call. For
N=1000, top 20 costs 11 mainnet HTTP requests /1002 methods cold, zero warm. These numbers are pinned by local
network-count tests; no paid live-provider benchmark was run.

## Consumer cadence

The caller landed during review. Read `origin/frontend/redesign`330690bda7f: `src/shell/ratings.ts` has no interval,
`staleTime: 0` and `retry: 1`; the app query client's focus/reconnect refetch defaults are disabled. This is observed
code, not a request for the frontend lane to change it.

- Lobby: `RosterGrid` reads one batch when mounted with a nonempty Realms-id roster. A changed roster changes the query
  key and reads again. There is no periodic rating poll while an unchanged lobby stays mounted.
- Season: `BlitzPanel` requests six top rows plus self when mounted; identity changes change the query key. The
  backend's top20 cost example is unchanged by this smaller display limit: both rank against all N holders.
- Profile: own profile mounts `OwnRatingLine`, one own-rating query. Desktop Results mounts the same component.
- A stale remount can refetch, failures can retry once and the Season error control calls refetch explicitly. Thus
  successful steady-state rating traffic is0 requests/minute while mounted without changes; one mount means one request,
  and a failure may add one retry. No hidden/focus/reconnect interval is invented here.
- Chat reads its first history page/socket on room entry, then receives socket messages. Further pages are on demand.
- The existing factory slots query really polls every3s (20 requests/minute per visible factory). This is a separate
  caller and does not turn ratings into a three-second poll. Population HEAD/GET is backend traffic only.

For24 lobby viewers mounting once during one minute/block:624 mainnet HTTP requests /624 methods before;25 /49 after
(one cold reader plus23 warm latest readers), or2 /26 with a shared explicit pin. With100 Season mounts per minute,
N=1000 and P=10:101200 /101200 before;11 /1002 after plus101 portal SQL reads. These are entry/remount workload
examples, not measured or configured polling frequencies. An unchanged mounted screen generates no subsequent rating
requests. A different hash incurs cold work, and the fixed method ceiling still bounds aggregate demand.
