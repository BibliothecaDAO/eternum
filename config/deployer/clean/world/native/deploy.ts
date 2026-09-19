import { CallData, type Account, type Call, type RawArgs } from "starknet";
import { declareClass, waitForSuccess } from "../../shared/declare";
import { nativePeers } from "./artifacts";
import { canonicalRealmTraits } from "./realm-catalogue";
import { inspectNativeWorld } from "./plan";
import type { NativeDomain, NativePlan, NativeTransaction, NativeWorld } from "./types";

export async function deployNativeWorld(
  local: NativeWorld,
  account: Account,
  onSubmitted: (transaction: NativeTransaction) => void,
  declarer: Account = account,
) {
  const before = await inspectNativeWorld(local, account);
  if (before.blockers.length) throw new Error(before.blockers.join("; "));
  const transactions: NativeTransaction[] = [];
  const record = (action: NativeTransaction["action"], domain: string, hash: string) => {
    const transaction = { action, domain, hash };
    transactions.push(transaction);
    onSubmitted(transaction);
  };
  for (const domain of local.domains) {
    const state = before.domains.find((state) => state.name === domain.name)!;
    await declareClass(declarer, domain, (hash) => record("declare", domain.name, hash));
    await deployDomain(account, domain, state.chainClassHash, record);
  }
  for (const domain of local.domains) {
    if (!before.domains.find((state) => state.name === domain.name)!.configured)
      await command(account, domain, "configure", { peers: nativePeers(local) }, record);
  }
  const configured = await inspectNativeWorld(local, account);
  if (configured.blockers.length || configured.domains.some((domain) => !domain.configured))
    throw new Error(`Native peer verification failed: ${configured.blockers.join("; ")}`);
  await initializeRealmCatalogue(local, account, configured, record);
  for (const domain of local.domains) {
    if (!configured.domains.find((state) => state.name === domain.name)!.active)
      await command(account, domain, "activate", {}, record);
  }
  const after = await inspectNativeWorld(local, account);
  if (!after.synced) throw new Error("Native deployment did not converge");
  return { before, after, transactions };
}

async function initializeRealmCatalogue(
  local: NativeWorld,
  account: Account,
  configured: NativePlan,
  record: (action: NativeTransaction["action"], domain: string, hash: string) => void,
) {
  const settlement = local.domains.find((domain) => domain.name === "settlement")!;
  const catalogue = configured.domains.find((domain) => domain.name === "settlement")!.realmCatalogue;
  if (!catalogue) throw new Error("Settlement catalogue inspection missing after declaration");
  for (let offset = catalogue.initialized; offset < canonicalRealmTraits.length; offset += 128)
    await command(
      account,
      settlement,
      "initialize_realm_traits",
      {
        first_realm: offset + 1,
        packed_traits: canonicalRealmTraits.slice(offset, offset + 128),
      },
      record,
    );
}

async function command(
  account: Account,
  domain: NativeDomain,
  entrypoint: "upgrade" | "configure" | "activate" | "initialize_realm_traits",
  args: RawArgs,
  record: (action: NativeTransaction["action"], domain: string, hash: string) => void,
) {
  const call: Call = {
    contractAddress: domain.address,
    entrypoint,
    calldata: new CallData(domain.sierra.abi).compile(entrypoint, args),
  };
  const result = await account.execute(call, { tip: 0 });
  record(entrypoint, domain.name, result.transaction_hash);
  await waitForSuccess(account, result.transaction_hash);
}

async function deployDomain(
  account: Account,
  domain: NativeDomain,
  chainClassHash: string | null,
  record: (action: NativeTransaction["action"], domain: string, hash: string) => void,
) {
  if (!chainClassHash) {
    const result = await account.deployContract(
      {
        classHash: domain.classHash,
        salt: domain.salt,
        constructorCalldata: domain.constructorCalldata,
        unique: false,
      },
      { tip: 0 },
    );
    record("deploy", domain.name, result.transaction_hash);
    await waitForSuccess(account, result.transaction_hash);
  } else if (BigInt(chainClassHash) !== BigInt(domain.classHash)) {
    await command(account, domain, "upgrade", { class_hash: domain.classHash }, record);
  }
}
