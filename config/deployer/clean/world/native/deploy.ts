import { CallData, type Account } from "starknet";
import { declareClass, waitForSuccess } from "../../shared/declare";
import { canonicalRealmTraits } from "./realm-catalogue";
import { inspectNativeWorld } from "./plan";
import type { NativePlan, NativeTransaction, NativeWorld } from "./types";

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
  for (const logic of local.logic) await declareClass(declarer, logic, (hash) => record("declare", logic.name, hash));
  await declareClass(declarer, local.games, (hash) => record("declare", "games", hash));
  if (!before.deployedClassHash) await deployGames(local, account, (hash) => record("deploy", "games", hash));
  const deployed = await inspectNativeWorld(local, account);
  if (deployed.blockers.length) throw new Error(deployed.blockers.join("; "));
  await initializeRealmCatalogue(local, account, deployed, (hash) => record("initialize_realm_traits", "games", hash));
  const after = await inspectNativeWorld(local, account);
  if (!after.synced) throw new Error("Native deployment did not converge");
  return { before, after, transactions };
}

async function initializeRealmCatalogue(
  local: NativeWorld,
  account: Account,
  plan: NativePlan,
  submitted: (hash: string) => void,
) {
  if (!plan.realmCatalogue) throw new Error("Games catalogue inspection missing after deployment");
  const codec = new CallData(local.games.sierra.abi);
  for (let offset = plan.realmCatalogue.initialized; offset < canonicalRealmTraits.length; offset += 128) {
    const result = await account.execute(
      {
        contractAddress: local.games.address,
        entrypoint: "initialize_realm_traits",
        calldata: codec.compile("initialize_realm_traits", {
          first_realm: offset + 1,
          packed_traits: canonicalRealmTraits.slice(offset, offset + 128),
        }),
      },
      { tip: 0 },
    );
    submitted(result.transaction_hash);
    await waitForSuccess(account, result.transaction_hash);
  }
}

async function deployGames(local: NativeWorld, account: Account, submitted: (hash: string) => void) {
  const games = local.games;
  const result = await account.deployContract(
    {
      classHash: games.classHash,
      salt: games.salt,
      constructorCalldata: games.constructorCalldata,
      unique: false,
    },
    { tip: 0 },
  );
  submitted(result.transaction_hash);
  await waitForSuccess(account, result.transaction_hash);
}
