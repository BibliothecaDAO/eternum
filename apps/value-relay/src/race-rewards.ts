import { Account, cairo, hash, type RpcProvider } from "starknet";
import {
  RACE_CLAIM_WINDOW_SECONDS,
  decodeRaceReward,
  decodeRaceSeason,
  raceCalldata,
  readConfirmedLedgerHead,
  readFinalLedgerHead,
  rpcAt,
} from "@realms-world/value-ledger";
import { rpcBatch } from "../../../packages/value-ledger/src/rpc";
import { SHARD_RPC_MAX_BATCH_CALLS } from "../../../packages/value-ledger/src/shard-rpc-limits";
import type { RaceCosigner } from "./cosigner-client";
import { closedRace, type FinalEvidence, type FinalFacts } from "./final-facts";
import { readFrontierGames } from "./frontier-games";
import { readFinishedRace, type FinishedRace, type OwedRaceReward } from "./race-facts";
import { forEachGame } from "./shard-jobs";
import type { ShardConnection } from "./shard-rpc";
import { optionalRow, readConfirmedSnapshot } from "./shard-snapshot";

const RACE_PAYMENTS_PER_TICK = 20;

export interface RaceSettlement {
  chainId: string;
  gameId: number;
  race: FinishedRace;
}

type UnpaidRaceReason = "no_payout_wallet" | "identity_unavailable";

export interface RaceReceipt {
  chainId: string;
  gameId: number;
  closedAt: number;
  unpaid: { home: string; amount: string; reason: UnpaidRaceReason }[];
}

interface RaceLedger {
  rpcUrl: string;
  rewardsAddress: string | null;
  accountAddress: string;
  privateKey: string;
  unfundedIsFault: boolean;
}

interface RacePorts {
  cosigner: RaceCosigner;
  payoutWallet(owner: string): Promise<string | null>;
  keepReceipt(receipt: RaceReceipt): Promise<void>;
}

type FundedRaceLedger = RaceLedger & { rewardsAddress: string };
type RaceCall = { entrypoint: string; calldata: string[] };

export const raceReceiptKey = (chainId: string, gameId: number) => `race-unpaid:${BigInt(chainId)}:${gameId}`;

export async function settleFinishedRaces(
  connection: ShardConnection,
  heraldUrl: string,
  finals: FinalFacts,
  settle: (settlement: RaceSettlement) => Promise<FinalEvidence | null>,
) {
  const { games } = await readFrontierGames(connection, heraldUrl);
  return forEachGame(games, (game) => settleGameRace(connection, heraldUrl, finals, game.game_id, settle));
}

async function settleGameRace(
  connection: ShardConnection,
  heraldUrl: string,
  finals: FinalFacts,
  gameId: number,
  settle: (settlement: RaceSettlement) => Promise<FinalEvidence | null>,
) {
  const closed = closedRace(connection.chainId, gameId);
  if (await finals.has(closed)) return;
  if (!(await hasRaceResult(connection, heraldUrl, gameId))) return;
  const race = await readFinishedRace(connection, heraldUrl, gameId);
  if (!race) return;
  const evidence = await settle({ chainId: connection.chainId, gameId, race });
  if (evidence) await finals.mark(closed, evidence);
}

async function hasRaceResult(connection: ShardConnection, heraldUrl: string, gameId: number) {
  return !!optionalRow(await readConfirmedSnapshot(connection, heraldUrl, gameId, ["RaceResult"]), "RaceResult");
}

export async function settleRace(
  ledger: RaceLedger,
  settlement: RaceSettlement,
  ports: RacePorts,
): Promise<FinalEvidence | null> {
  if (!isDeployed(ledger)) return refuseUnfunded(ledger);
  const provider = rpcAt(ledger.rpcUrl);
  const head = await readConfirmedLedgerHead(provider);
  const season = await readRaceSeason(provider, ledger, settlement, head.number);
  if (season.closed) return closureEvidence(provider, ledger, settlement);
  if (!season.funded) return refuseUnfunded(ledger);
  const { race } = settlement;
  if (race.total > season.pool) throw new Error("race_total_exceeds_pool");
  if (!season.posted) {
    await sendRaceCalls(ledger, provider, [await postCall(settlement, ports.cosigner)]);
    return null;
  }
  if (season.total !== race.total) throw new Error("race_post_differs");
  const paid = season.paid === 0n ? new Set<bigint>() : await paidHomes(ledger, settlement, head.number);
  const owed = await sortOwedRewards(
    race.rewards.filter((reward) => !paid.has(reward.home)),
    ports,
  );
  await payRewards(ledger, provider, settlement, owed.payable.slice(0, RACE_PAYMENTS_PER_TICK), ports.cosigner);
  const windowOver = head.time >= season.postedAt + RACE_CLAIM_WINDOW_SECONDS;
  if (owed.payable.length > RACE_PAYMENTS_PER_TICK || (owed.unpaid.length > 0 && !windowOver)) return null;
  await ports.keepReceipt({
    chainId: settlement.chainId,
    gameId: settlement.gameId,
    closedAt: head.time,
    unpaid: owed.unpaid,
  });
  await sendRaceCalls(ledger, provider, [
    { entrypoint: "close_race", calldata: raceCalldata("close_race", raceKey(settlement)) },
  ]);
  return null;
}

const isDeployed = (ledger: RaceLedger): ledger is FundedRaceLedger => ledger.rewardsAddress !== null;

function refuseUnfunded(ledger: RaceLedger): null {
  if (ledger.unfundedIsFault) throw new Error("race_unfunded");
  return null;
}

const raceKey = ({ chainId, gameId }: RaceSettlement) => ({ shard: chainId, season_id: gameId });

async function readRaceSeason(
  provider: RpcProvider,
  ledger: FundedRaceLedger,
  settlement: RaceSettlement,
  block: number,
) {
  return decodeRaceSeason(
    await provider.callContract(
      {
        contractAddress: ledger.rewardsAddress,
        entrypoint: "get_race",
        calldata: raceCalldata("get_race", raceKey(settlement)),
      },
      block,
    ),
  );
}

async function closureEvidence(provider: RpcProvider, ledger: FundedRaceLedger, settlement: RaceSettlement) {
  const final = await readFinalLedgerHead(provider);
  const season = await readRaceSeason(provider, ledger, settlement, final.number);
  return season.closed ? { block: final.number, hash: final.hash } : null;
}

async function paidHomes(ledger: FundedRaceLedger, settlement: RaceSettlement, block: number) {
  const homes = settlement.race.rewards.map((reward) => reward.home);
  const selector = hash.getSelectorFromName("get_race_reward");
  const paid = new Set<bigint>();
  for (let start = 0; start < homes.length; start += SHARD_RPC_MAX_BATCH_CALLS) {
    const batch = homes.slice(start, start + SHARD_RPC_MAX_BATCH_CALLS);
    const rewards = await rpcBatch<string[]>(
      ledger.rpcUrl,
      "starknet_call",
      batch.map((home) => ({
        request: {
          contract_address: ledger.rewardsAddress,
          entry_point_selector: selector,
          calldata: raceCalldata("get_race_reward", { ...raceKey(settlement), home }).map(hexFelt),
        },
        block_id: { block_number: block },
      })),
    );
    rewards.forEach((fields, index) => {
      if (decodeRaceReward(fields)) paid.add(batch[index]!);
    });
  }
  return paid;
}

const hexFelt = (value: string | number | bigint) => `0x${BigInt(value).toString(16)}`;

async function sortOwedRewards(rewards: readonly OwedRaceReward[], ports: RacePorts) {
  const payable: { reward: OwedRaceReward; wallet: string }[] = [];
  const unpaid: RaceReceipt["unpaid"] = [];
  for (const reward of rewards) {
    const wallet = await payoutWalletOrReason(ports, reward.owner);
    if ("reason" in wallet)
      unpaid.push({ home: String(reward.home), amount: String(reward.amount), reason: wallet.reason });
    else payable.push({ reward, wallet: wallet.address });
  }
  return { payable, unpaid };
}

async function payoutWalletOrReason(
  ports: RacePorts,
  owner: string,
): Promise<{ address: string } | { reason: UnpaidRaceReason }> {
  try {
    const address = await ports.payoutWallet(owner);
    return address ? { address } : { reason: "no_payout_wallet" };
  } catch {
    return { reason: "identity_unavailable" };
  }
}

async function payRewards(
  ledger: FundedRaceLedger,
  provider: RpcProvider,
  settlement: RaceSettlement,
  payable: readonly { reward: OwedRaceReward; wallet: string }[],
  cosigner: RaceCosigner,
) {
  const calls: RaceCall[] = [];
  let refused: unknown;
  for (const { reward, wallet } of payable) {
    try {
      calls.push(await payCall(settlement, reward, wallet, cosigner));
    } catch (error) {
      refused ??= error;
    }
  }
  if (calls.length > 0) await sendRaceCalls(ledger, provider, calls);
  if (refused) throw refused;
}

async function postCall(settlement: RaceSettlement, cosigner: RaceCosigner): Promise<RaceCall> {
  const total = String(settlement.race.total);
  const signature = await cosigner.postRace({ shard: settlement.chainId, season: settlement.gameId, total });
  return {
    entrypoint: "post_race",
    calldata: raceCalldata("post_race", {
      ...raceKey(settlement),
      total: cairo.uint256(total),
      signature_r: signature.r,
      signature_s: signature.s,
    }),
  };
}

async function payCall(
  settlement: RaceSettlement,
  reward: OwedRaceReward,
  wallet: string,
  cosigner: RaceCosigner,
): Promise<RaceCall> {
  const terms = { home: String(reward.home), wallet, amount: String(reward.amount) };
  const signature = await cosigner.payRace({ shard: settlement.chainId, season: settlement.gameId, ...terms });
  return {
    entrypoint: "pay_race",
    calldata: raceCalldata("pay_race", {
      ...raceKey(settlement),
      home: terms.home,
      wallet,
      amount: cairo.uint256(terms.amount),
      signature_r: signature.r,
      signature_s: signature.s,
    }),
  };
}

async function sendRaceCalls(ledger: FundedRaceLedger, provider: RpcProvider, calls: readonly RaceCall[]) {
  const account = new Account({ provider, address: ledger.accountAddress, signer: ledger.privateKey });
  const tx = await account.execute(calls.map((call) => ({ contractAddress: ledger.rewardsAddress, ...call })));
  const receipt = await provider.waitForTransaction(tx.transaction_hash, { errorStates: [] });
  if (receipt.isReverted()) throw new Error("race_transaction_reverted", { cause: receipt.revert_reason });
}
