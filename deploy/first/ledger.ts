import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Account, byteArray, CallData, hash, json, type Call, type RpcProvider } from "starknet";
import { buildLedgerEconomicPreset } from "../../config/deployer/clean/ledger/economics";
import { buildMysteryChestPreset } from "../../contracts/l2/ledger/scripts/chest-preset.js";
import { addressBook, root, type Environment, type Inputs, type Target } from "./settings";
import { classAt, isMissing, isContractRevert, confirm, send } from "./chain";
import { seconds, PublicError } from "./dates";
import type { PrivateStore } from "./private-store";

export type Assets = { ledger: string; lords: string; mmr: string; chests: string; cosmetics: string };
export type AssetPlan = { name: keyof Assets; package: string; artifact: string; constructor: string[] };
function collectibleConstructor(name: string, admin: string) {
  return CallData.compile([
    byteArray.byteArrayFromString(name),
    byteArray.byteArrayFromString(name),
    byteArray.byteArrayFromString(""),
    byteArray.byteArrayFromString("Dev test collection (no value)"),
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
  const plans: AssetPlan[] = target.freshAssets
    ? [
        { name: "lords", package: "ledger", artifact: "TestLords", constructor: [] },
        { name: "mmr", package: "mmr", artifact: "MMRToken", constructor: [admin, admin] },
        {
          name: "chests",
          package: "collectibles",
          artifact: "RealmsCollectible",
          constructor: collectibleConstructor(target.chestName, admin),
        },
        {
          name: "cosmetics",
          package: "collectibles",
          artifact: "RealmsCollectible",
          constructor: collectibleConstructor(target.cosmeticsName, admin),
        },
      ]
    : [];
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
) {
  const classHash = hash.computeSierraContractClassHash(artifacts.contract);
  const salt = fixedSalt(environment, account.address, plan.name);
  const address = hash.calculateContractAddressFromHash(salt, classHash, plan.constructor, 0);
  const pin = { classHash, address, constructor: plan.constructor };
  const previous = store.read<typeof pin>(`asset-${plan.name}.json`);
  if (previous && JSON.stringify(previous) !== JSON.stringify(pin))
    throw new Error("Saved deployment differs from artifacts or constructor; refusing another deployment");
  store.write(`asset-${plan.name}.json`, pin);
  const existing = await classAt(account, address);
  if (existing) {
    if (BigInt(existing) !== BigInt(classHash)) throw new Error("Deployed class differs");
    return address;
  }
  try {
    await account.getClassByHash(classHash);
  } catch (error) {
    if (!isMissing(error, 28)) throw error;
    const declared = await account.declareIfNot(artifacts);
    if (declared.transaction_hash) await confirm(account, declared.transaction_hash);
  }
  const deployed = await account.deployContract({
    classHash,
    constructorCalldata: plan.constructor,
    salt,
    unique: false,
  });
  await confirm(account, deployed.transaction_hash);
  if (BigInt(deployed.address) !== BigInt(address)) throw new Error("Deployment address differs from fixed salt");
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
      throw new Error("Existing ledger belongs to different accounts; restore its original private directory");
  }
}
export function publishAssets(target: Target, assets: Assets) {
  const path = join(root, "contracts/common/addresses", target.book);
  const book = addressBook(target);
  for (const [key, value] of Object.entries({
    ledger: assets.ledger,
    lords: assets.lords,
    mmrToken: assets.mmr,
    lootChests: assets.chests,
    cosmetics: assets.cosmetics,
  })) {
    if (book[key] && BigInt(book[key]!) !== 0n && BigInt(book[key]!) !== BigInt(value))
      throw new Error("Address book already names another deployment");
    book[key] = value;
  }
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ ...book, l2Chain: "SN_MAIN" }, null, 2) + "\n", { flag: "wx" });
  renameSync(temporary, path);
}
const call = (contractAddress: string, entrypoint: string, values: Parameters<typeof CallData.compile>[0]): Call => ({
  contractAddress,
  entrypoint,
  calldata: CallData.compile(values),
});
export function setupCalls(target: Target, assets: Assets, pauser: string, start: number, end: number) {
  const preset = buildMysteryChestPreset();
  return [
    call(assets.mmr, "grant_role", [hash.getSelectorFromName("UPDATER_ROLE"), assets.ledger]),
    call(assets.chests, "grant_role", [hash.getSelectorFromName("MINTER_ROLE"), assets.ledger]),
    call(assets.cosmetics, "grant_role", [hash.getSelectorFromName("MINTER_ROLE"), assets.ledger]),
    call(assets.ledger, "grant_role", [hash.getSelectorFromName("PAUSER_ROLE"), pauser]),
    ...(target.freshAssets
      ? [
          ...preset.bands.map((band: { metadata: number }) =>
            call(assets.chests, "set_attrs_raw_to_ipfs_cid", [
              band.metadata,
              byteArray.byteArrayFromString(target.picture),
              false,
            ]),
          ),
          ...preset.items.flatMap((items: number[]) =>
            items.map((item) =>
              call(assets.cosmetics, "set_attrs_raw_to_ipfs_cid", [
                item,
                byteArray.byteArrayFromString(target.picture),
                false,
              ]),
            ),
          ),
        ]
      : []),
    call(assets.ledger, "register_preset", [
      target.blitzPreset,
      buildLedgerEconomicPreset("blitz", { environment: target.environment as Environment }),
      preset.bands,
      preset.items,
    ]),
    call(assets.ledger, "register_preset", [
      target.frontierPreset,
      buildLedgerEconomicPreset("frontier"),
      preset.bands,
      preset.items,
    ]),
    call(assets.ledger, "open_season", [1, target.blitzPreset, start, end]),
  ];
}
/** Metadata updates put both the attribute and ByteArray CID in event keys. Check every page at a pinned head. */
async function metadataPresent(provider: RpcProvider, operation: Call, head: number) {
  const args = operation.calldata as string[];
  let continuation_token: string | undefined;
  let found = false;
  do {
    const page = await provider.getEvents({
      address: operation.contractAddress,
      from_block: { block_number: 0 },
      to_block: { block_number: head },
      keys: [[hash.getSelectorFromName("AttrsRawToIPFSCIDUpdated")], [args[0]!]],
      chunk_size: 100,
      ...(continuation_token ? { continuation_token } : {}),
    });
    for (const event of page.events) {
      if (
        JSON.stringify(event.keys.slice(1).map(BigInt).map(String)) !==
        JSON.stringify(args.slice(0, -1).map(BigInt).map(String))
      )
        throw new Error("Existing collectible metadata differs");
      found = true;
    }
    continuation_token = page.continuation_token;
  } while (continuation_token);
  return found;
}
export async function setupPresent(provider: RpcProvider, operation: Call, head: number) {
  const args = operation.calldata as string[];
  if (operation.entrypoint === "set_attrs_raw_to_ipfs_cid") return metadataPresent(provider, operation, head);
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
      if (result.length !== 1 || ![0n, 1n].includes(BigInt(result[0]!))) throw new Error("Invalid role read");
      return BigInt(result[0]!) === 1n;
    }
    if (entrypoint === "get_preset") {
      const economics = args.slice(1, 19);
      if (
        result.length !== economics.length ||
        result.slice(0, economics.length).some((felt, index) => BigInt(felt) !== BigInt(economics[index]!))
      )
        throw new Error("Registered preset differs");
      const chest = buildMysteryChestPreset();
      for (let index = 0; index < 5; index++) {
        for (const [entrypoint, expected] of [
          ["get_chest_band", CallData.compile(chest.bands[index]!)],
          ["get_cosmetic_items", CallData.compile([chest.items[index]!])],
        ] as const) {
          const fields = await provider.callContract(
            { contractAddress: operation.contractAddress, entrypoint, calldata: [args[0]!, String(index)] },
            head,
          );
          if (
            fields.length !== expected.length ||
            fields.some((felt, position) => BigInt(felt) !== BigInt(expected[position]!))
          )
            throw new Error("Registered chest rewards differ");
        }
      }
    }
    if (
      entrypoint === "get_season" &&
      (result.length !== 16 ||
        BigInt(result[10]!) !== 1n ||
        BigInt(result[11]!) !== BigInt(args[1]!) ||
        BigInt(result[12]!) !== BigInt(args[2]!) ||
        BigInt(result[13]!) !== BigInt(args[3]!))
    )
      throw new Error("Existing Blitz season differs");
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
) {
  const head = await account.getBlockWithTxHashes("latest");
  if (!("block_number" in head)) throw new Error("Confirmed mainnet head required");
  const start = seconds(input.blitzStart);
  const desired = setupCalls(target, assets, pauser, start, seconds(input.blitzEnd));
  const missing: Call[] = [];
  for (const operation of desired)
    if (!(await setupPresent(account, operation, head.block_number!))) missing.push(operation);
  if (!missing.length) return true;
  if (missing.some((call) => call.entrypoint === "open_season") && start <= head.timestamp)
    throw new PublicError(
      "Blitz start is no longer in the future. Choose new explicit dates in inputs.json before sending setup.",
    );
  if (target.coldAdmin) {
    store.write("cold-setup.json", { account: input.admin, calls: missing });
    return false;
  }
  await send(account, missing, store, "setup");
  return true;
}
