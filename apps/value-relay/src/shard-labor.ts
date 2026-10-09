import { Account, type Abi } from "starknet";
import { ShardReader, sameFelt, felt, uint, type ShardConnection } from "./shard-rpc";
import { Effect } from "effect";
import { RelayFailure, relayOperation, type LaborClaim, type LaborGrant, type RelayEffect } from "./ports";
import { rpcAt } from "@realms-world/value-ledger";

interface LaborTarget {
  connection: ShardConnection;
  operatorAddress: string;
  privateKey: string;
}

/** Global eligibility supersedes seeded game days; its published clock/key ABI is still pending. */
export const currentLaborDay = (): RelayEffect<number> =>
  Effect.fail(new RelayFailure({ operation: "interface_unavailable:labor.global_day" }));

/** Direct role entry: a configured server account signs one grant; limits and exact retry rules remain on the shard. */
export const writeLaborGrant = (target: LaborTarget, claim: LaborClaim) =>
  relayOperation("write Realm labor grant", async (): Promise<LaborGrant> => {
    if (!sameFelt(claim.chainId, target.connection.chainId)) throw new Error("labor_chain_differs");
    const reader = new ShardReader(target.connection);
    const head = await reader.head();
    const provider = reader.provider();
    const contract = await provider.getClassAt(target.connection.gamesAddress, head);
    validateLaborAbi(contract.abi);
    const calldata = laborCalldata(claim);
    const role = await provider.callContract(
      { contractAddress: target.connection.gamesAddress, entrypoint: "ledger_operator", calldata: [] },
      "latest",
    );
    if (role.length !== 1 || BigInt(role[0]!) === 0n || !sameFelt(role[0]!, target.operatorAddress))
      throw new Error("only_ledger_operator");
    const prior = await laborGrantAt(target.connection, calldata.slice(0, 4));
    if (prior) return matchingGrant(prior, claim);
    const admin = rpcAt(target.connection.rpcUrl);
    if (!sameFelt(await admin.getChainId(), target.connection.chainId)) throw new Error("labor_admin_chain_differs");
    const account = new Account({ provider: admin, address: target.operatorAddress, signer: target.privateKey });
    const transaction = await account.execute({
      contractAddress: target.connection.gamesAddress,
      entrypoint: "grant_labor",
      calldata,
    });
    const receipt = await admin.waitForTransaction(transaction.transaction_hash);
    if (receipt.isReverted()) throw new Error("labor_grant_reverted");
    const grant = await laborGrantAt(target.connection, calldata.slice(0, 4));
    if (!grant) throw new Error("labor_grant_not_recorded");
    return matchingGrant(grant, claim);
  });
const laborCalldata = (claim: LaborClaim) => {
  const gameId = uint(String(claim.gameId), 32);
  const realmId = uint(claim.realmId, 32);
  const home = uint(claim.home, 32);
  const day = uint(String(claim.day), 64);
  if (!gameId || realmId < 1n || realmId > 8000n || home === 0n || BigInt(felt(claim.account)) === 0n)
    throw new Error("invalid_labor_claim");
  return [String(gameId), String(realmId), String(home), String(day), claim.account];
};
const laborGrantAt = async (connection: ShardConnection, calldata: string[]): Promise<LaborGrant | null> => {
  const fields = await rpcAt(connection.rpcUrl).callContract(
    { contractAddress: connection.gamesAddress, entrypoint: "labor_grant", calldata },
    "latest",
  );
  if (fields.length === 1 && BigInt(fields[0]!) === 1n) return null;
  if (fields.length !== 4 || BigInt(fields[0]!) !== 0n) throw new Error("invalid_labor_grant");
  return { account: felt(fields[1]!), home: String(uint(fields[2]!, 32)), amount: String(uint(fields[3]!, 128)) };
};
const matchingGrant = (grant: LaborGrant, claim: LaborClaim) => {
  if (!sameFelt(grant.account, claim.account) || BigInt(grant.home) !== BigInt(claim.home))
    throw new Error("labor_already_claimed");
  return grant;
};
const validateLaborAbi = (raw: unknown) => {
  const abi = (typeof raw === "string" ? JSON.parse(raw) : raw) as Abi;
  if (!Array.isArray(abi)) throw new Error("labor_abi_unavailable");
  const items = abi.flatMap((item) => (item.type === "interface" ? item.items : [item])) as {
    type: string;
    name: string;
    inputs?: { name: string; type: string }[];
    members?: { name: string; type: string }[];
  }[];
  const entry = items.find((item) => item.type === "function" && item.name === "grant_labor");
  if (
    entry?.inputs?.map((field) => field.name).join() !== "realm,day,account" ||
    !entry.inputs[1]!.type.endsWith("::u64") ||
    !entry.inputs[2]!.type.endsWith("::ContractAddress")
  )
    throw new Error("labor_abi_mismatch");
  const realm = items.find((item) => item.type === "struct" && item.name === entry.inputs![0]!.type);
  if (
    realm?.members?.map((member) => `${member.name}:${member.type.split("::").at(-1)}`).join() !==
    "game_id:u32,realm_id:u32,home:u32"
  )
    throw new Error("labor_realm_abi_mismatch");
};
