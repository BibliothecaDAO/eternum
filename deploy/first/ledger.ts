import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Account, byteArray, CallData, hash, json, num, type Call, type RpcProvider } from "starknet";
import { buildLedgerEconomicPreset, chestPresetFor } from "../../config/deployer/clean/ledger/economics";
import { awardableCosmetics } from "../../contracts/l2/ledger/scripts/chest-preset.js";
import { addressBook, root, type Environment, type Inputs, type Target } from "./settings";
import { classAt, isMissing, isContractRevert, confirm, send } from "./chain";
import { seconds } from "./dates";
import { PublicError } from "./errors";
import { resolveBlitzSeason } from "./blitz-season";
import type { PrivateStore } from "./private-store";

export type Assets = { ledger: string; lords: string; mmr: string; chests: string; cosmetics: string };
export type AssetPlan = { name: keyof Assets; package: string; artifact: string; constructor: string[] };
function collectibleConstructor(name: string, description: string, admin: string) {
  return CallData.compile([
    byteArray.byteArrayFromString(name),
    byteArray.byteArrayFromString(name),
    byteArray.byteArrayFromString(""),
    byteArray.byteArrayFromString(description),
    admin,
    admin,
    admin,
    admin,
    admin,
    admin,
    0,
  ]);
}
export function assetPlans(
  target: Target,
  admin: string,
  operator: string,
  treasury: string,
  assets: Partial<Assets>,
): AssetPlan[] {
  // Each environment deploys the assets its book does not name: production's book names dev's test LORDS, so it
  // deploys its own rating token and collections and owns its ledger, roles and pause.
  const testAssets: AssetPlan[] = [
    { name: "lords", package: "ledger", artifact: "TestLords", constructor: [] },
    { name: "mmr", package: "mmr", artifact: "MMRToken", constructor: [admin, admin] },
    {
      name: "chests",
      package: "collectibles",
      artifact: "RealmsCollectible",
      constructor: collectibleConstructor(target.chestName, target.collectionDescription, admin),
    },
    {
      name: "cosmetics",
      package: "collectibles",
      artifact: "RealmsCollectible",
      constructor: collectibleConstructor(target.cosmeticsName, target.collectionDescription, admin),
    },
  ];
  const plans = testAssets.filter((plan) => !assets[plan.name]);
  if (assets.lords && assets.mmr && assets.chests && assets.cosmetics)
    plans.push({
      name: "ledger",
      package: "ledger",
      artifact: "GameLedger",
      constructor: [admin, operator, treasury, assets.lords, assets.mmr, assets.chests, assets.cosmetics],
    });
  return plans;
}
export function fixedSalt(environment: Environment, owner: string, name: string) {
  return hash.starknetKeccak(`realms:${environment}:${BigInt(owner)}:${name}`).toString();
}
export function loadArtifact(directory: string, plan: AssetPlan) {
  const name = `${plan.package === "ledger" ? "game_ledger" : plan.package}_${plan.artifact}`;
  return {
    contract: json.parse(readFileSync(join(directory, `${name}.contract_class.json`), "utf8")),
    casm: json.parse(readFileSync(join(directory, `${name}.compiled_contract_class.json`), "utf8")),
  };
}
export async function deployAsset(
  account: Account,
  environment: Environment,
  plan: AssetPlan,
  artifacts: ReturnType<typeof loadArtifact>,
  store: PrivateStore,
  output: (line: string) => void,
) {
  const classHash = hash.computeSierraContractClassHash(artifacts.contract);
  const salt = fixedSalt(environment, account.address, plan.name);
  const address = hash.calculateContractAddressFromHash(salt, classHash, plan.constructor, 0);
  const pin = { classHash, address, constructor: plan.constructor };
  const previous = store.read<typeof pin>(`asset-${plan.name}.json`);
  if (previous && JSON.stringify(previous) !== JSON.stringify(pin))
    throw new PublicError("Saved deployment differs from artifacts or constructor; refusing another deployment");
  store.write(`asset-${plan.name}.json`, pin);
  const existing = await classAt(account, address);
  if (existing) {
    if (BigInt(existing) !== BigInt(classHash)) throw new PublicError("Deployed class differs");
    return address;
  }
  try {
    await account.getClassByHash(classHash);
  } catch (error) {
    if (!isMissing(error, 28)) throw error;
    const declared = await account.declareIfNot(artifacts);
    if (declared.transaction_hash) await confirm(account, declared.transaction_hash, output);
  }
  const deployed = await account.deployContract({
    classHash,
    constructorCalldata: plan.constructor,
    salt,
    unique: false,
  });
  await confirm(account, deployed.transaction_hash, output);
  if (BigInt(deployed.address) !== BigInt(address)) throw new PublicError("Deployment address differs from fixed salt");
  return address;
}
export function existingAssets(target: Target): Partial<Assets> {
  const book = addressBook(target);
  return Object.fromEntries(
    Object.entries({
      ledger: book.ledger,
      lords: book.lords,
      mmr: book.mmrToken,
      chests: book.lootChests,
      cosmetics: book.cosmetics,
    }).filter(([, value]) => value && BigInt(value) > 0n),
  );
}
export async function verifyLedgerAccounts(provider: RpcProvider, ledger: string, admin: string, operator: string) {
  for (const [role, address] of [
    ["0x0", admin],
    [hash.getSelectorFromName("OPERATOR_ROLE"), operator],
  ]) {
    const result = await provider.callContract(
      { contractAddress: ledger, entrypoint: "has_role", calldata: [role!, address!] },
      "latest",
    );
    if (result.length !== 1 || BigInt(result[0]!) !== 1n)
      throw new PublicError("Existing ledger belongs to different accounts; restore its original private directory");
  }
}
/** The block the address book says the ledger was deployed in; the relay starts every ledger history scan there. */
export function recordedLedgerBlock(target: Target): number | undefined {
  const block = (addressBook(target) as Record<string, unknown>).ledgerDeploymentBlock;
  return typeof block === "number" ? block : undefined;
}
export function publishAssets(target: Target, assets: Assets, ledgerDeploymentBlock: number) {
  const path = join(root, "contracts/common/addresses", target.book);
  const book: Record<string, string | number> = addressBook(target);
  for (const [key, value] of Object.entries({
    ledger: assets.ledger,
    lords: assets.lords,
    mmrToken: assets.mmr,
    lootChests: assets.chests,
    cosmetics: assets.cosmetics,
  })) {
    if (book[key] && BigInt(book[key]!) !== 0n && BigInt(book[key]!) !== BigInt(value))
      throw new PublicError("Address book already names another deployment");
    book[key] = value;
  }
  const recorded = recordedLedgerBlock(target);
  if (recorded !== undefined && recorded !== ledgerDeploymentBlock)
    throw new PublicError("Address book already names another ledger deployment block");
  book.ledgerDeploymentBlock = ledgerDeploymentBlock;
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ ...book, l2Chain: "SN_MAIN" }, null, 2) + "\n", { flag: "wx" });
  renameSync(temporary, path);
}
const call = (contractAddress: string, entrypoint: string, values: Parameters<typeof CallData.compile>[0]): Call => ({
  contractAddress,
  entrypoint,
  calldata: CallData.compile(values),
});
export function setupCalls(
  target: Target,
  assets: Assets,
  pauser: string,
  start: number,
  end: number,
  seasonId: number,
) {
  const chests = chestPresetFor(target.environment as Environment);
  const metadata = (collection: string, attributes: number) =>
    call(collection, "set_attrs_raw_to_ipfs_cid", [attributes, byteArray.byteArrayFromString(target.picture), false]);
  return [
    call(assets.mmr, "grant_role", [hash.getSelectorFromName("UPDATER_ROLE"), assets.ledger]),
    call(assets.chests, "grant_role", [hash.getSelectorFromName("MINTER_ROLE"), assets.ledger]),
    call(assets.cosmetics, "grant_role", [hash.getSelectorFromName("MINTER_ROLE"), assets.ledger]),
    call(assets.ledger, "grant_role", [hash.getSelectorFromName("PAUSER_ROLE"), pauser]),
    ...chests.bands.map((band) => metadata(assets.chests, band.metadata)),
    ...awardableCosmetics(chests).map((item: number) => metadata(assets.cosmetics, item)),
    call(assets.ledger, "register_preset", [
      target.blitzPreset,
      buildLedgerEconomicPreset("blitz", { environment: target.environment as Environment, chests }),
      chests.bands,
      chests.items,
    ]),
    call(assets.ledger, "register_preset", [
      target.frontierPreset,
      buildLedgerEconomicPreset("frontier", { chests }),
      chests.bands,
      chests.items,
    ]),
    call(assets.ledger, "open_season", [seasonId, target.blitzPreset, start, end]),
  ];
}
/** Find the first block containing this contract; only code 20 means it did not exist yet. */
export async function deploymentBlock(provider: RpcProvider, address: string, head: number) {
  await provider.getClassHashAt(address, head);
  let low = 0;
  let high = head;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    try {
      await provider.getClassHashAt(address, middle);
      high = middle;
    } catch (error) {
      if (!isMissing(error, 20)) throw error;
      low = middle + 1;
    }
  }
  return low;
}

/** One run shares the two collection deployment searches, including concurrent metadata reads. */
export function setupPresenceReader(provider: RpcProvider) {
  const deployments = new Map<string, Promise<number>>();
  return (operation: Call, head: number) => {
    if (operation.entrypoint !== "set_attrs_raw_to_ipfs_cid") return setupPresent(provider, operation, head);
    const address = num.toHex(operation.contractAddress);
    let first = deployments.get(address);
    if (!first) {
      first = deploymentBlock(provider, address, head);
      deployments.set(address, first);
    }
    return first.then((fromBlock) => metadataPresent(provider, operation, head, fromBlock));
  };
}

/** Metadata updates put both the attribute and ByteArray CID in event keys. Check every page at a pinned head. */
async function metadataPresent(provider: RpcProvider, operation: Call, head: number, fromBlock: number) {
  const args = operation.calldata as string[];
  let continuation_token: string | undefined;
  let found = false;
  do {
    const page = await provider.getEvents({
      address: operation.contractAddress,
      from_block: { block_number: fromBlock },
      to_block: { block_number: head },
      keys: [[hash.getSelectorFromName("AttrsRawToIPFSCIDUpdated")], [num.toHex(args[0]!)]],
      chunk_size: 100,
      ...(continuation_token ? { continuation_token } : {}),
    });
    for (const event of page.events) {
      if (
        JSON.stringify(event.keys.slice(1).map(BigInt).map(String)) !==
        JSON.stringify(args.slice(0, -1).map(BigInt).map(String))
      )
        throw new PublicError("Existing collectible metadata differs");
      found = true;
    }
    continuation_token = page.continuation_token;
  } while (continuation_token);
  return found;
}
/**
 * The ledger stores a preset's five chest bands, then its five cosmetic rarities, in the order register_preset's
 * calldata carries them after the 18 economic fields; each read must match the next fields of that same call.
 */
async function assertRegisteredChestRewards(provider: RpcProvider, operation: Call, head: number) {
  const args = operation.calldata as string[];
  let next = 20;
  for (const entrypoint of ["get_chest_band", "get_cosmetic_items"]) {
    for (let index = 0; index < 5; index++) {
      const fields = await provider.callContract(
        { contractAddress: operation.contractAddress, entrypoint, calldata: [args[0]!, String(index)] },
        head,
      );
      const expected = args.slice(next, next + fields.length);
      if (expected.length !== fields.length || fields.some((felt, at) => BigInt(felt) !== BigInt(expected[at]!)))
        throw new PublicError("Registered chest rewards differ");
      next += fields.length;
    }
    next += 1;
  }
}
async function setupPresent(provider: RpcProvider, operation: Call, head: number) {
  const args = operation.calldata as string[];
  const entrypoint =
    operation.entrypoint === "grant_role"
      ? "has_role"
      : operation.entrypoint === "register_preset"
        ? "get_preset"
        : "get_season";
  try {
    const result = await provider.callContract(
      {
        contractAddress: operation.contractAddress,
        entrypoint,
        calldata: operation.entrypoint === "grant_role" ? args : [args[0]!],
      },
      head,
    );
    if (entrypoint === "has_role") {
      if (result.length !== 1 || ![0n, 1n].includes(BigInt(result[0]!))) throw new PublicError("Invalid role read");
      return BigInt(result[0]!) === 1n;
    }
    if (entrypoint === "get_preset") {
      const economics = args.slice(1, 19);
      if (
        result.length !== economics.length ||
        result.slice(0, economics.length).some((felt, index) => BigInt(felt) !== BigInt(economics[index]!))
      )
        throw new PublicError("Registered preset differs");
      await assertRegisteredChestRewards(provider, operation, head);
    }
    if (
      entrypoint === "get_season" &&
      (result.length !== 16 ||
        BigInt(result[10]!) !== 1n ||
        BigInt(result[11]!) !== BigInt(args[1]!) ||
        BigInt(result[12]!) !== BigInt(args[2]!) ||
        BigInt(result[13]!) !== BigInt(args[3]!))
    )
      throw new PublicError("Existing Blitz season differs");
    return true;
  } catch (error) {
    const reason = entrypoint === "get_preset" ? "Ledger: unknown preset" : "Ledger: unknown Blitz season";
    if (isContractRevert(error, reason)) return false;
    throw error;
  }
}
export async function configureLedger(
  account: Account,
  target: Target,
  assets: Assets,
  pauser: string,
  input: Inputs,
  store: PrivateStore,
  output: (line: string) => void,
  readPresence = setupPresenceReader(account),
) {
  const start = seconds(input.blitzStart);
  const end = seconds(input.blitzEnd);
  const season = await resolveBlitzSeason(account, assets.ledger, start, end);
  const desired = setupCalls(target, assets, pauser, start, end, season.id);
  output("Reading collectible metadata on mainnet.");
  const present = await Promise.all(desired.map((operation) => readPresence(operation, season.head)));
  const missing = desired.filter((_, index) => !present[index]);
  if (!missing.length) return true;
  if (missing.some((call) => call.entrypoint === "open_season") && start <= season.now)
    throw new PublicError(
      "Blitz start is no longer in the future. Choose new explicit dates in inputs.json before sending setup.",
    );
  if (target.coldAdmin) {
    store.write("cold-setup.json", { account: input.admin, calls: missing });
    return false;
  }
  await send(account, missing, store, `setup-${assets.ledger}-${season.id}`, output, season.head);
  return true;
}
