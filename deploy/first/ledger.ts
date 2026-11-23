import mainnetAddresses from "../../contracts/common/addresses/mainnet.json";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Account, byteArray, CallData, hash, json, num, type Call, type RpcProvider } from "starknet";
import { awardableCosmetics, chestPresets } from "../../contracts/l2/ledger/scripts/chest-preset.js";
import { addressBook, root, type Environment, type Inputs, type Target } from "./settings";
import { classAt, isMissing, confirm, send } from "./chain";
import { PublicError } from "./errors";
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
  cosignerPublicKey: string,
): AssetPlan[] {
  assertProductionLords(target, assets.lords);
  if (!cosignerPublicKey || BigInt(cosignerPublicKey) <= 0n)
    throw new PublicError("Independent co-signer public key required");
  const ownAssets: AssetPlan[] = [
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
  const plans = ownAssets.filter((plan) => !assets[plan.name]);
  if (assets.lords && assets.mmr && assets.chests && assets.cosmetics)
    plans.push({
      name: "ledger",
      package: "ledger",
      artifact: "GameLedger",
      constructor: [
        admin,
        operator,
        treasury,
        assets.lords,
        assets.mmr,
        assets.chests,
        assets.cosmetics,
        cosignerPublicKey,
      ],
    });
  return plans;
}
function assertProductionLords(target: Target, lords: string | undefined) {
  if (target.environment === "production" && (!lords || BigInt(lords) !== BigInt(mainnetAddresses.lords)))
    throw new PublicError("Production requires the canonical mainnet LORDS token; test or missing LORDS refused");
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
  if (store.read(retiredPin(plan.name, address)))
    throw new PublicError(
      `The retired ${plan.name} has this address; change its constructor or deployer to deploy a new one`,
    );
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
  assertProductionLords(target, book.lords);
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
export async function verifyLedgerAccounts(
  provider: RpcProvider,
  ledger: string,
  admin: string,
  operator: string,
  cosignerPublicKey: string,
) {
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
  const key = await provider.callContract({ contractAddress: ledger, entrypoint: "cosigner", calldata: [] }, "latest");
  if (key.length !== 2 || BigInt(key[0]!) !== BigInt(cosignerPublicKey))
    throw new PublicError("Existing ledger co-signer differs from the configured independent key");
}
/** The block the address book says the ledger was deployed in; the relay starts every ledger history scan there. */
export function recordedLedgerBlock(target: Target): number | undefined {
  const block = (addressBook(target) as Record<string, unknown>).ledgerDeploymentBlock;
  return typeof block === "number" ? block : undefined;
}
export function publishAssets(target: Target, assets: Assets, ledgerDeploymentBlock: number) {
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
  writeAddressBook(target, book);
}
/** Replaces the environment's public address book in one rename; it always names mainnet. */
export function writeAddressBook(target: Target, book: Record<string, string | number>) {
  const path = join(root, "contracts/common/addresses", target.book);
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ ...book, l2Chain: "SN_MAIN" }, null, 2) + "\n", { flag: "wx" });
  renameSync(temporary, path);
}
/** The private record of a retired contract's pin; setup never deploys that contract at its address again. */
export const retiredPin = (name: keyof Assets, address: string) => `retired-asset-${name}-${num.toHex(address)}.json`;
const call = (contractAddress: string, entrypoint: string, values: Parameters<typeof CallData.compile>[0]): Call => ({
  contractAddress,
  entrypoint,
  calldata: CallData.compile(values),
});
function chestPresetFor(target: Target) {
  const build = chestPresets[target.chests as keyof typeof chestPresets];
  if (!build) throw new Error(`Unknown chest preset ${target.chests}`);
  return build();
}
export function setupCalls(target: Target, assets: Assets, pauser: string) {
  assertProductionLords(target, assets.lords);
  const chests = chestPresetFor(target);
  const metadata = (collection: string, attributes: number) =>
    call(collection, "set_attrs_raw_to_ipfs_cid", [attributes, byteArray.byteArrayFromString(target.picture), false]);
  return [
    call(assets.mmr, "grant_role", [hash.getSelectorFromName("UPDATER_ROLE"), assets.ledger]),
    call(assets.chests, "grant_role", [hash.getSelectorFromName("MINTER_ROLE"), assets.ledger]),
    call(assets.cosmetics, "grant_role", [hash.getSelectorFromName("MINTER_ROLE"), assets.ledger]),
    call(assets.ledger, "grant_role", [hash.getSelectorFromName("PAUSER_ROLE"), pauser]),
    ...chests.bands.map((band) => metadata(assets.chests, band.metadata)),
    ...awardableCosmetics(chests).map((item: number) => metadata(assets.cosmetics, item)),
  ];
}
export async function setupHead(provider: RpcProvider) {
  const head = await provider.getBlockWithTxHashes("latest");
  if (!("block_number" in head)) throw new PublicError("Confirmed mainnet head required");
  return head.block_number!;
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
    if (operation.entrypoint !== "set_attrs_raw_to_ipfs_cid") return rolePresent(provider, operation, head);
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
async function rolePresent(provider: RpcProvider, operation: Call, head: number) {
  const result = await provider.callContract(
    { contractAddress: operation.contractAddress, entrypoint: "has_role", calldata: operation.calldata as string[] },
    head,
  );
  if (result.length !== 1 || ![0n, 1n].includes(BigInt(result[0]!))) throw new PublicError("Invalid role read");
  return BigInt(result[0]!) === 1n;
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
  const head = await setupHead(account);
  const desired = setupCalls(target, assets, pauser);
  output("Reading collectible metadata on mainnet.");
  const present = await Promise.all(desired.map((operation) => readPresence(operation, head)));
  const missing = desired.filter((_, index) => !present[index]);
  if (!missing.length) return true;
  if (target.coldAdmin) {
    store.write("cold-setup.json", { account: input.admin, calls: missing });
    return false;
  }
  await send(account, missing, store, `setup-${assets.ledger}-frontier`, output, head);
  return true;
}
