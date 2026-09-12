import { hash, type Account } from "starknet";
import { declareClass, waitForSuccess } from "../shared/declare";
import { inspectWorld, worldCall } from "./plan";
import type { DeploymentReport, LocalWorld, WorldPlan } from "./types";

export async function deployWorld(
  local: LocalWorld,
  account: Account,
  onTransaction: (record: DeploymentReport["transactions"][number]) => void,
): Promise<DeploymentReport> {
  const before = await inspectWorld(local, account);
  if (before.blockers.length) throw new Error(before.blockers.join("\n"));
  validateWorldTarget(local, before);
  const transactions: DeploymentReport["transactions"] = [];
  const record = (action: string, resource: string, hash: string) => {
    const entry = { action, resource, hash };
    transactions.push(entry);
    onTransaction(entry);
  };
  const execute = async (entrypoint: string, resource: string, args: Record<string, unknown>) => {
    const result = await account.execute(worldCall(local, entrypoint, args), { tip: 0 });
    record(entrypoint, resource, result.transaction_hash);
    await waitForSuccess(account, result.transaction_hash);
  };
  await declareWorldClasses(local, account, record);
  await deployOrUpgradeWorld(local, account, before, record, execute);
  if (!before.namespaceRegistered)
    await execute("register_namespace", local.profile.namespace.default, {
      namespace: local.profile.namespace.default,
    });
  await registerWorldResources(local, before, execute);
  await grantWorldWriters(before, execute);
  await initializeWorldContracts(local, before, execute);
  const after = await inspectWorld(local, account);
  if (!isWorldSynced(after)) throw new Error("World did not converge; run inspect to review remaining differences");
  return { before, after, transactions };
}

export function isWorldSynced(plan: WorldPlan): boolean {
  return (
    plan.blockers.length === 0 &&
    plan.namespaceRegistered &&
    plan.resources.every((resource) => resource.action === "synced" && resource.declared && resource.initialized) &&
    plan.writers.every((writer) => writer.granted)
  );
}

type RecordTransaction = (action: string, resource: string, hash: string) => void;
type ExecuteWorldCall = (entrypoint: string, resource: string, args: Record<string, unknown>) => Promise<void>;

async function declareWorldClasses(local: LocalWorld, account: Account, record: RecordTransaction) {
  for (const resource of [{ ...local.world, tag: "world" }, ...local.resources]) {
    await declareClass(account, resource, (hash) => record("declare", resource.tag, hash));
  }
}

async function deployOrUpgradeWorld(
  local: LocalWorld,
  account: Account,
  plan: WorldPlan,
  record: RecordTransaction,
  execute: ExecuteWorldCall,
) {
  const world = plan.resources[0];
  if (world.action === "deploy") {
    const result = await account.deployContract(
      {
        classHash: local.world.classHash,
        salt: local.salt,
        constructorCalldata: [],
        unique: false,
      },
      { tip: 0 },
    );
    record("deploy_world", "world", result.transaction_hash);
    await waitForSuccess(account, result.transaction_hash);
    if (BigInt(result.contract_address) !== BigInt(local.address)) throw new Error("World deployment address mismatch");
  } else if (world.action === "upgrade") {
    await execute("upgrade", "world", { new_class_hash: local.world.classHash });
  }
}

async function registerWorldResources(local: LocalWorld, plan: WorldPlan, execute: ExecuteWorldCall) {
  const comparisons = new Map(plan.resources.map((resource) => [resource.tag, resource]));
  for (const kind of ["library", "model", "event", "contract"] as const) {
    for (const resource of local.resources.filter((resource) => resource.kind === kind)) {
      const action = comparisons.get(resource.tag)!.action;
      if (action === "synced") continue;
      const args: Record<string, unknown> = { namespace: resource.namespace, class_hash: resource.classHash };
      if (kind === "library") Object.assign(args, { name: resource.name, version: resource.version });
      if (kind === "contract" && action === "register") args.salt = resource.selector;
      await execute(`${action}_${kind}`, resource.tag, args);
    }
  }
}

async function grantWorldWriters(plan: WorldPlan, execute: ExecuteWorldCall) {
  for (const writer of plan.writers) {
    if (!writer.granted)
      await execute("grant_writer", writer.resource, { resource: writer.resource, contract: writer.contract });
  }
}

async function initializeWorldContracts(local: LocalWorld, plan: WorldPlan, execute: ExecuteWorldCall) {
  const comparisons = new Map(plan.resources.map((resource) => [resource.tag, resource]));
  for (const resource of local.resources) {
    if (resource.kind === "contract" && !comparisons.get(resource.tag)!.initialized) {
      await execute("init_contract", resource.tag, {
        selector: resource.selector,
        init_calldata: resource.initCalldata,
      });
    }
  }
}

function validateWorldTarget(local: LocalWorld, plan: WorldPlan) {
  if (plan.resources[0].action !== "deploy") return;
  const expected = hash.calculateContractAddressFromHash(local.salt, local.world.classHash, [], 0);
  if (BigInt(expected) !== BigInt(local.address)) {
    throw new Error(`Absent world address ${local.address} differs from the seed-derived address ${expected}`);
  }
}
