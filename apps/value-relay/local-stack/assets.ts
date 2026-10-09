import { Account, CallData, RpcProvider, byteArray, hash, uint256 } from "starknet";
import { join } from "node:path";
import type { StackConfig } from "./config";

export interface LocalAccount {
  address: string;
  private_key: string;
}
export interface Assets {
  ledger: string;
  lords: string;
  mmr: string;
  chests: string;
  cosmetics: string;
  realms: string;
}

/** Reuses the ledger rehearsal's artifact and preset builders on the combined trunk checkout. */
export const deployAssets = async (
  root: string,
  config: StackConfig,
  accounts: LocalAccount[],
  manifest: { chainId: string; contracts: Record<string, string> },
) => {
  const { provider, account, confirm, deploy, buildLedgerEconomicPreset, buildMysteryChestPreset } =
    await assetDeployer(root, config, accounts[0]!);
  const admin = accounts[0]!;
  const lords = await deploy("ledger", "game_ledger", "TestLords", []);
  const mmr = await deploy("mmr", "mmr", "MMRToken", [admin.address, admin.address]);
  const chests = await deploy(
    "collectibles",
    "collectibles",
    "RealmsCollectible",
    collectibleConstructor("Local Chests", admin.address),
  );
  const cosmetics = await deploy(
    "collectibles",
    "collectibles",
    "RealmsCollectible",
    collectibleConstructor("Local Cosmetics", admin.address),
  );
  const realms = await deploy("season_pass", "esp", "TestRealm", [admin.address]);
  const ledger = await deploy("ledger", "game_ledger", "GameLedger", [
    admin.address,
    accounts[1]!.address,
    admin.address,
    lords,
    mmr,
    realms,
    realms,
    chests,
    cosmetics,
  ]);
  const { game, preset, pool, shardTimestamp } = await readFrontierFunding(config, manifest, buildLedgerEconomicPreset);
  const chest = buildMysteryChestPreset();
  const l2Head = await provider.getBlock("latest");
  const start = Math.max(l2Head.timestamp, Math.floor(Date.now() / 1000)) + 60;
  const assets = { ledger, lords, mmr, chests, cosmetics, realms };
  await confirm(
    await account.execute(
      setupCalls(
        assets,
        accounts,
        manifest.chainId,
        game,
        preset,
        chest,
        buildLedgerEconomicPreset("blitz"),
        pool,
        start,
      ),
    ),
  );
  // Fund the shard's original window before aligning this stand-in clock; never alter the shard calendar.
  const clock = await fetch(`http://127.0.0.1:${config.devnetPort}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "devnet_setTime",
      params: { time: Math.max(shardTimestamp, Math.floor(Date.now() / 1000)) },
    }),
  });
  if (!clock.ok || ((await clock.json()) as { error?: unknown }).error) throw new Error("local_clock_alignment_failed");
  return { ledger, lords, mmr, chests, cosmetics, realms };
};

const assetDeployer = async (root: string, config: StackConfig, admin: LocalAccount) => {
  const artifactsModule = join(root, "contracts/scripts-runtime/js/artifacts.js");
  const economicsModule = join(root, "config/deployer/clean/ledger/economics.ts");
  const chestModule = join(root, "contracts/l2/ledger/scripts/chest-preset.js");
  const { getContractArtifactPaths, readContractArtifacts } = await import(artifactsModule);
  const { buildLedgerEconomicPreset } = await import(economicsModule);
  const { buildMysteryChestPreset } = await import(chestModule);
  const provider = new RpcProvider({ nodeUrl: `http://127.0.0.1:${config.devnetPort}/rpc` });

  const account = new Account({ provider, address: admin.address, signer: admin.private_key });
  const confirm = async (transaction: { transaction_hash: string }) => {
    const receipt = await provider.waitForTransaction(transaction.transaction_hash, { errorStates: [] });
    if (receipt.isReverted()) throw new Error("local_setup_reverted");
  };
  const deploy = async (directory: string, pkg: string, name: string, constructor: string[]) => {
    const artifacts = readContractArtifacts(
      getContractArtifactPaths(join(root, "contracts/l2", directory, "target/release"), pkg, name),
    );
    const declared = await account.declareIfNot({ contract: artifacts.contract, casm: artifacts.casm });
    if (declared.transaction_hash) await confirm({ transaction_hash: declared.transaction_hash });
    const deployment = await account.deployContract({
      classHash: declared.class_hash,
      constructorCalldata: constructor,
    });
    await confirm(deployment);
    return deployment.address;
  };
  return { provider, account, confirm, deploy, buildLedgerEconomicPreset, buildMysteryChestPreset };
};

const collectibleConstructor = (name: string, adminAddress: string) =>
  CallData.compile([
    byteArray.byteArrayFromString(name),
    byteArray.byteArrayFromString("TEST"),
    byteArray.byteArrayFromString(""),
    byteArray.byteArrayFromString("Local test collection"),
    ...Array(6).fill(adminAddress),
    0,
  ]);

const readFrontierFunding = async (
  config: StackConfig,
  manifest: { chainId: string; contracts: Record<string, string> },
  buildLedgerEconomicPreset: (format: string, options: { presetId: number }) => Record<string, number>,
) => {
  const shard = new RpcProvider({ nodeUrl: config.shardRpcUrl });
  if (BigInt(await shard.getChainId()) !== BigInt(manifest.chainId)) throw new Error("shard_chain_differs");
  const head = await shard.getBlock("latest");
  if (
    !("block_number" in head) ||
    !("status" in head) ||
    !["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(head.status ?? "")
  )
    throw new Error("confirmed_shard_required");
  const game = await shard.callContract(
    { contractAddress: manifest.contracts.games!, entrypoint: "game", calldata: [String(config.frontierGameId)] },
    head.block_number,
  );
  if (game.length !== 10) throw new Error("current_game_registry_required");
  const response = await fetch(
    new URL(`/games/${config.frontierGameId}/snapshot?models=SliceRules,ChestRules`, config.shardHeraldUrl),
  );
  if (!response.ok) throw new Error("frontier_snapshot_unavailable");
  const snapshot = (await response.json()) as {
    confirmed_block: number;
    models: { model: string; rows: { value: Record<string, string | number> }[] }[];
  };
  if (snapshot.confirmed_block > head.block_number || !Number.isSafeInteger(snapshot.confirmed_block))
    throw new Error("frontier_snapshot_unconfirmed");
  const row = (name: string) => {
    const rows = snapshot.models.filter((model) => model.model === name).flatMap((model) => model.rows);
    if (rows.length !== 1 || BigInt(rows[0]!.value.game_id!) !== BigInt(config.frontierGameId))
      throw new Error("frontier_snapshot_differs");
    return rows[0]!.value;
  };
  const preset = buildLedgerEconomicPreset("frontier", { presetId: Number(BigInt(game[1]!)) });
  const chestRules = row("ChestRules");
  if (
    preset.day_unit_seconds !== Number(row("SliceRules").day_unit_seconds) ||
    preset.claim_window_seconds !== Number(chestRules.claim_window_seconds) ||
    BigInt(game[7]!) - BigInt(game[6]!) !== 20n * BigInt(preset.day_unit_seconds) * BigInt(preset.season_bags!)
  )
    throw new Error("frontier_economics_differs");
  return { game, preset, pool: BigInt(chestRules.pool!) * 10n ** 18n, shardTimestamp: head.timestamp };
};

const setupCalls = (
  assets: Assets,
  accounts: LocalAccount[],
  shard: string,
  game: string[],
  preset: Record<string, number>,
  chest: { bands: { metadata: number }[]; items: number[][] },
  blitzPreset: unknown,
  pool: bigint,
  start: number,
) => {
  const { ledger, lords, mmr, chests, cosmetics, realms } = assets;
  const admin = accounts[0]!;
  const call = (contractAddress: string, entrypoint: string, args: unknown[]) => ({
    contractAddress,
    entrypoint,
    calldata: CallData.compile(args as never),
  });
  const calls = [
    call(mmr, "grant_role", [hash.getSelectorFromName("UPDATER_ROLE"), ledger]),
    ...[chests, cosmetics].map((address) =>
      call(address, "grant_role", [hash.getSelectorFromName("MINTER_ROLE"), ledger]),
    ),
    call(ledger, "grant_role", [hash.getSelectorFromName("PAUSER_ROLE"), accounts[2]!.address]),
    ...chest.bands.map((band: { metadata: number }, i: number) =>
      call(chests, "set_attrs_raw_to_ipfs_cid", [
        band.metadata,
        byteArray.byteArrayFromString(`local-chest-${i + 1}`),
        false,
      ]),
    ),
    ...chest.items
      .flat()
      .map((item: number) =>
        call(cosmetics, "set_attrs_raw_to_ipfs_cid", [item, byteArray.byteArrayFromString("local-cosmetic"), false]),
      ),
    call(lords, "mint", [admin.address, uint256.bnToUint256(pool)]),
    call(lords, "approve", [ledger, uint256.bnToUint256(pool)]),
    call(ledger, "register_preset", [1, blitzPreset, chest.bands, chest.items]),
    call(ledger, "register_preset", [2, preset, chest.bands, chest.items]),
    call(ledger, "open_season", [1, 1, start, start + 30 * 86400]),
    call(ledger, "fund_frontier", [shard, 1, 2, game[6]!, game[9]!, uint256.bnToUint256(pool)]),
    ...accounts.map((owner) => call(lords, "mint", [owner.address, uint256.bnToUint256(100000n * 10n ** 18n)])),
    call(realms, "mint", [uint256.bnToUint256(1n)]),
  ];
  return calls;
};
