import { decodeNativeRow } from "../../../packages/core/src/client/native-row";
import { StructureType } from "@bibliothecadao/types";
import { realmsAccountAddress } from "../../../packages/identity/src/account";
import { rpcAt } from "@realms-world/value-ledger";
import { confirmedDepositBlock, type DepositAnchors, type LordsDeposit } from "@realms-world/value-ledger/deposits";
import { readConfirmedSnapshot, singleRow, type ConfirmedSnapshot } from "./shard-snapshot";
import { ShardReader, type ShardConnection } from "./shard-rpc";
import { readShardAbi } from "../../../packages/value-ledger/src/shard-abi";

export type DepositEvidence = Awaited<ReturnType<typeof readDepositEvidence>>;

export async function readDepositEvidence(
  shard: ShardConnection & { heraldUrl: string },
  game: number,
  anchors?: DepositAnchors,
) {
  const snapshot = await readConfirmedSnapshot(shard, shard.heraldUrl, game, [
    "GameRegistry",
    "DepositSource",
    "Structure",
  ]);
  const provider = rpcAt(shard.rpcUrl);
  if (BigInt(await provider.getChainId()) !== BigInt(shard.chainId)) throw new Error("deposit_shard_chain_differs");
  const key = `shard:${BigInt(shard.chainId)}:${BigInt(shard.gamesAddress)}:${game}`;
  const block = await confirmedDepositBlock(provider, await anchors?.getAnchor(key), snapshot.confirmed_block);
  const read = (entrypoint: string, calldata: string[], contractAddress = shard.gamesAddress) =>
    provider.callContract({ contractAddress, entrypoint, calldata }, block.head.hash);
  const remember = async () => {
    await block.assertCanonical();
    await anchors?.putAnchor(key, block.head);
  };
  return { ...block, snapshot, read, remember };
}

/** Invalid destinations can be cancelled; unavailable evidence must remain an obligation. */
export async function depositDestinationError(
  evidence: DepositEvidence,
  destination: Pick<LordsDeposit, "account" | "realmsId" | "home">,
): Promise<string | null> {
  const game = singleRow(evidence.snapshot, "GameRegistry");
  if (evidence.head.time < Number(game.start_main_at) || evidence.head.time >= Number(game.end_at))
    return "deposit_destination_not_live";
  if (!isOwnedRealm(evidence.snapshot, destination)) return "deposit_home_differs";
  return depositIdentityError(evidence, destination);
}
export async function depositIdentityError(
  evidence: DepositEvidence,
  destination: Pick<LordsDeposit, "account" | "realmsId">,
): Promise<string | null> {
  const authentication = await evidence.read("authentication", []);
  if (authentication.length !== 2) throw new Error("invalid_shard_authentication");
  if (
    BigInt(destination.realmsId) === 0n ||
    BigInt(realmsAccountAddress(destination.realmsId, authentication[0]!, authentication[1]!)) !==
      BigInt(destination.account)
  )
    return "deposit_account_not_native";
  const id = await evidence.read("realms_id", [], destination.account);
  if (id.length !== 1) throw new Error("deposit_identity_unavailable");
  return BigInt(id[0]!) === BigInt(destination.realmsId) ? null : "deposit_identity_differs";
}
export function depositStructures(snapshot: ConfirmedSnapshot) {
  const model = snapshot.models.find(({ model }) => model === "Structure");
  if (!model) throw new Error("deposit_structures_missing");
  return model.rows.map(({ value }) => decodeNativeRow("Structure", value));
}
function isOwnedRealm(snapshot: ConfirmedSnapshot, destination: Pick<LordsDeposit, "account" | "home">) {
  const row = depositStructures(snapshot).find((row) => row.entity_id === BigInt(destination.home));
  return !!row && row.base.category === StructureType.Realm && row.owner === BigInt(destination.account);
}

export async function supportsDeposits(shard: ShardConnection): Promise<boolean> {
  const head = await new ShardReader(shard).header("latest");
  const abi = await readShardAbi(rpcAt(shard.rpcUrl), shard.gamesAddress, head.block_number);
  return abi.some(
    (item) =>
      item.type === "interface" && item.items?.some((entry: { name?: string }) => entry.name === "deposit_source"),
  );
}
