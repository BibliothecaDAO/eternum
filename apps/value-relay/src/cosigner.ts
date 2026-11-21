import { decodeDepositSigningRequest, depositReader, type DepositAnchors } from "@realms-world/value-ledger/deposits";
import { verifiedDepositHash } from "./deposit-verifier";
import { ec } from "starknet";
import { raceRewardsBeside } from "@realms-world/chain";
import { isLoopbackHttp } from "./source-url";
import { Effect } from "effect";
import {
  rpcAt,
  readConfirmedLedgerHead,
  decodeWithdrawalPayment,
  decodeCosigner,
  decodeRaceSeason,
  cosigningHash,
  raceCosigningHash,
  decodeCosignRequest,
  type Cosignature,
  type PayoutTerms,
  type RacePayTerms,
  type RacePostTerms,
  type SettlementTerms,
} from "@realms-world/value-ledger";
import { ShardReader, type ShardConnection } from "./shard-rpc";
import { frontierReceiptBindings } from "./frontier-binding";
import { shardWithdrawalPorts } from "./shard-withdrawals";
import { frontierSettlementEvidence } from "./frontier-sweep";
import { readFinishedRace } from "./race-facts";

export interface CosignerConfig {
  l2RpcUrl: string;
  l2ChainId: string;
  ledgerAddress: string;
  identityUrl: string;
  identityToken: string;
  requestToken: string;
  shards: (ShardConnection & { heraldUrl: string })[];
}

export interface CosignerWallets extends DepositAnchors {
  assertWallet(account: string, realmsId: string, wallet: string): void;
  pendingChanges(): { count: number; oldestSince: number | null };
}

/** No operator-provided source, wallet lookup or digest is trusted; source connections belong to the box configuration. */
export function createCosigner(
  config: CosignerConfig,
  privateKey: string,
  wallets: CosignerWallets,
  network: typeof fetch = fetch,
) {
  requireLocalShardSources(config.shards);
  const publicKey = ec.starkCurve.getStarkKey(privateKey);
  const provider = rpcAt(config.l2RpcUrl);
  const identity = (account: string) => readPayoutIdentity(config, account, network);
  return {
    publicKey,
    health: () => ({ service: "payout-cosigner", publicKey, pendingWalletChanges: wallets.pendingChanges() }),
    async sign(input: unknown): Promise<Cosignature> {
      const kind = input && typeof input === "object" ? (input as { kind?: unknown }).kind : null;
      const isDeposit = ["deposit", "resolve-deposit", "principal"].includes(String(kind));
      const request = isDeposit
        ? decodeDepositSigningRequest(input as Record<string, unknown>)
        : decodeCosignRequest(input);
      const shard = config.shards.find((row) => BigInt(row.chainId) === BigInt(request.shard));
      if (!shard) throw new Error("cosigner_shard_unlisted");
      if (BigInt(await provider.getChainId()) !== BigInt(config.l2ChainId))
        throw new Error("cosigner_l2_chain_differs");
      const head = await readConfirmedLedgerHead(provider);
      const readAt = (contractAddress: string) => (entrypoint: string, calldata: string[]) =>
        provider.callContract({ contractAddress, entrypoint, calldata }, head.number);
      const read = readAt(config.ledgerAddress);
      const [key, paused] = await Promise.all([read("cosigner", []), read("is_paused", [])]);
      const domain = decodeCosigner(key);
      if (BigInt(domain.publicKey) !== BigInt(publicKey)) throw new Error("cosigner_key_differs");
      if (paused.length !== 1 || BigInt(paused[0]!) !== 0n) throw new Error("cosigner_ledger_paused");
      const signingDomain = { chainId: config.l2ChainId, ledger: config.ledgerAddress, epoch: domain.epoch };
      if (request.kind === "race-post" || request.kind === "race-pay") {
        const rewards = raceRewardsBeside(config.ledgerAddress);
        if (request.kind === "race-post") await verifyRacePost(shard, request);
        else await verifyRacePay(shard, request, identity, wallets, readAt(rewards));
        return signatureOf(
          raceCosigningHash({ chainId: config.l2ChainId, rewards, epoch: domain.epoch }, request),
          privateKey,
        );
      }
      if (request.kind !== "pay" && request.kind !== "settle") {
        const anchorKey = `ledger:${BigInt(config.l2ChainId)}:${BigInt(config.ledgerAddress)}`;
        const ledger = await depositReader(
          provider,
          config.ledgerAddress,
          config.l2ChainId,
          await wallets.getAnchor(anchorKey),
        );
        const depositKey = decodeCosigner(await ledger.read("cosigner", []));
        const depositPaused = await ledger.read("is_paused", []);
        if (
          BigInt(depositKey.publicKey) !== BigInt(publicKey) ||
          depositPaused.length !== 1 ||
          BigInt(depositPaused[0]!) !== 0n
        )
          throw new Error("deposit_signer_unavailable");
        const digest = await verifiedDepositHash(
          {
            domain: { ...signingDomain, epoch: depositKey.epoch },
            publicKey,
            shard,
            ledger,
            anchors: wallets,
            payoutIdentity: (account, wallet) => verifyPayoutWallet(identity, wallets, account, wallet),
          },
          request,
        );
        await ledger.assertCanonical();
        await wallets.putAnchor(anchorKey, ledger.head);
        return signatureOf(digest, privateKey);
      }
      if (request.kind === "pay") {
        await verifyPayment(config, shard, request, identity, read, wallets);
      } else {
        await verifySettlement(config, shard, request);
      }
      return signatureOf(cosigningHash(signingDomain, request), privateKey);
    },
  };
}
function signatureOf(digest: string, privateKey: string): Cosignature {
  const signature = ec.starkCurve.sign(digest, privateKey);
  return { r: `0x${signature.r.toString(16)}`, s: `0x${signature.s.toString(16)}` };
}
async function verifyRacePost(shard: CosignerConfig["shards"][number], request: RacePostTerms) {
  const race = await readFinishedRace(shard, shard.heraldUrl, request.season);
  if (!race) throw new Error("cosigner_race_unfinished");
  if (race.total !== BigInt(request.total)) throw new Error("cosigner_race_differs");
}
async function verifyRacePay(
  shard: CosignerConfig["shards"][number],
  request: RacePayTerms,
  identity: (account: string) => ReturnType<typeof readPayoutIdentity>,
  wallets: CosignerWallets,
  readRewards: (entrypoint: string, calldata: string[]) => Promise<string[]>,
) {
  const race = await readFinishedRace(shard, shard.heraldUrl, request.season);
  if (!race) throw new Error("cosigner_race_unfinished");
  const posted = decodeRaceSeason(await readRewards("get_race", [request.shard, String(request.season)]));
  if (!posted.posted || posted.closed || posted.total !== race.total) throw new Error("cosigner_race_differs");
  const reward = race.rewards.find((owed) => owed.home === BigInt(request.home));
  if (!reward || reward.amount !== BigInt(request.amount)) throw new Error("cosigner_race_differs");
  await verifyPayoutWallet(identity, wallets, reward.owner, request.wallet);
}
async function verifyPayment(
  config: CosignerConfig,
  shard: CosignerConfig["shards"][number],
  request: PayoutTerms,
  identity: (account: string) => ReturnType<typeof readPayoutIdentity>,
  read: (entrypoint: string, calldata: string[]) => Promise<string[]>,
  wallets: CosignerWallets,
) {
  const reader = new ShardReader(shard);
  const bindings = frontierReceiptBindings(
    reader,
    () => ({ rpcUrl: config.l2RpcUrl, address: config.ledgerAddress }),
    { realmsIdForAccount: async (account) => (await identity(account))?.realmsId ?? null },
    shard.heraldUrl,
  );
  const receipt = await Effect.runPromise(
    shardWithdrawalPorts(reader, bindings).withdrawalReceipt(request.shard, request.claim),
  );
  if (!receipt || !matchesReceipt(request, receipt)) throw new Error("cosigner_receipt_differs");
  await verifyPayoutWallet(identity, wallets, receipt.account, request.wallet);
  const reported = decodeWithdrawalPayment(await read("get_payment", [request.shard, request.claim]));
  if (!reported || reported.paid || !matchesReceipt(request, reported)) throw new Error("cosigner_report_differs");
}
async function verifyPayoutWallet(
  identity: (account: string) => ReturnType<typeof readPayoutIdentity>,
  wallets: CosignerWallets,
  account: string,
  wallet: string,
) {
  const player = await identity(account);
  if (!player || BigInt(player.wallet) !== BigInt(wallet)) throw new Error("cosigner_wallet_differs");
  wallets.assertWallet(account, player.realmsId, player.wallet);
  return player.realmsId;
}
async function verifySettlement(
  config: CosignerConfig,
  shard: CosignerConfig["shards"][number],
  request: SettlementTerms,
) {
  const evidence = await frontierSettlementEvidence(
    shard,
    shard.heraldUrl,
    {
      chainId: request.shard,
      gameId: request.season,
      chestWithdrawn: request.chest,
      prizeWithdrawn: request.prize,
    },
    { rpcUrl: config.l2RpcUrl, address: config.ledgerAddress },
    request.treasuryAmount,
  );
  if (evidence !== null) throw new Error("cosigner_settlement_differs");
}
function matchesReceipt(
  request: PayoutTerms,
  receipt: { seasonId: number; amount: string; prizeRank: number; prizeCount: number },
) {
  return (
    receipt.seasonId === request.season &&
    BigInt(receipt.amount) === BigInt(request.amount) &&
    receipt.prizeRank === request.rank &&
    receipt.prizeCount === request.count
  );
}
async function readPayoutIdentity(config: CosignerConfig, account: string, network: typeof fetch) {
  const url = new URL("/api/operator/payout-identity", config.identityUrl);
  url.searchParams.set("account", account);
  const response = await network(url, {
    headers: { authorization: `Bearer ${config.identityToken}` },
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("cosigner_identity_unavailable");
  const data = (await response.json()) as { identity: { realmsId: string; wallet: string } | null };
  if (data.identity === null) return null;
  if (
    !data.identity ||
    typeof data.identity.realmsId !== "string" ||
    typeof data.identity.wallet !== "string" ||
    BigInt(data.identity.realmsId) <= 0n ||
    BigInt(data.identity.wallet) <= 0n
  )
    throw new Error("cosigner_identity_invalid");
  return data.identity;
}

/** Authentication controls requests, never what may be signed. Failed verification yields no signature. */
export async function handleCosignRequest(
  request: Request,
  config: CosignerConfig,
  signer: ReturnType<typeof createCosigner>,
) {
  if (request.method === "GET" && new URL(request.url).pathname === "/health")
    return Response.json(signer.health(), { headers: { "cache-control": "no-store" } });
  if (request.method !== "POST" || new URL(request.url).pathname !== "/sign")
    return new Response(null, { status: 404 });
  const { presentsOperatorToken } = await import("@realms-world/identity");
  if (!(await presentsOperatorToken(request, config.requestToken))) return new Response(null, { status: 401 });
  try {
    const body = await request.text();
    if (body.length > 4096) return new Response(null, { status: 413 });
    return Response.json(await signer.sign(JSON.parse(body)), { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "cosigning_refused" }, { status: 503 });
  }
}

function requireLocalShardSources(shards: CosignerConfig["shards"]) {
  for (const shard of shards) {
    for (const endpoint of [shard.rpcUrl, shard.heraldUrl]) {
      const url = new URL(endpoint);
      if (!isLoopbackHttp(url)) throw new Error("cosigner_shard_requires_numeric_loopback_http");
    }
  }
}
