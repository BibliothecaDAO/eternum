import { inspectNativeWorld } from "./plan";
import { CallData, type Account } from "starknet";
import { isClassDeclared, waitForSuccess } from "../../shared/declare";
import type { NativeTransaction, NativeWorld } from "./types";

export async function registerNativeRelease(
  local: NativeWorld,
  account: Account,
  submitted: (hash: string) => void,
): Promise<void> {
  if (
    BigInt(local.release.migrationClassHash) !== 0n &&
    !(await isClassDeclared(account, local.release.migrationClassHash))
  )
    throw new Error("NATIVE_MIGRATION_NOT_DECLARED: declare the migration class before registering the release");
  const result = await account.execute(
    {
      contractAddress: local.games.address,
      entrypoint: "register_release",
      calldata: new CallData(local.games.sierra.abi).compile("register_release", {
        release_id: local.release.releaseId,
        release: { classes: local.release.classes.logic, migration: local.release.migrationClassHash },
      }),
    },
    { tip: 0 },
  );
  submitted(result.transaction_hash);
  await waitForSuccess(account, result.transaction_hash);
}

/** Registration and Herald publication must finish before a game can advance its pin. */
export async function applyNativeRelease(
  local: NativeWorld,
  account: Account,
  gameIds: number[],
  heraldUrl: string,
  submitted: (transaction: NativeTransaction) => void,
): Promise<void> {
  if (gameIds.some((id) => !Number.isSafeInteger(id) || id <= 0 || id > 0xffffffff))
    throw new Error("Invalid hotfix game ids");
  const plan = await inspectNativeWorld(local, account);
  if (plan.blockers.length) throw new Error(plan.blockers.join("; "));
  if (!plan.releaseRegistered)
    throw new Error("NATIVE_RELEASE_NOT_REGISTERED: register the release before applying games");
  const pins = await Promise.all(gameIds.map((gameId) => readGamePin(local, account, gameId)));
  await requirePublishedReleases(
    local,
    heraldUrl,
    pins.map(({ releaseId }) => releaseId),
  );
  for (const pin of pins) await advanceGameRelease(local, account, pin, submitted);
}

type GamePin = { gameId: number; releaseId: number };

async function readGamePin(local: NativeWorld, account: Account, gameId: number): Promise<GamePin> {
  const current = await account.callContract({
    contractAddress: local.games.address,
    entrypoint: "game_release",
    calldata: [String(gameId)],
  });
  const releaseId = Number(BigInt(current[0]));
  if (!Number.isSafeInteger(releaseId) || releaseId < 1 || releaseId > local.release.releaseId)
    throw new Error("NATIVE_RELEASE_DOWNGRADE: rollback requires registering the old classes as a new release");
  return { gameId, releaseId };
}

async function advanceGameRelease(
  local: NativeWorld,
  account: Account,
  { gameId, releaseId }: GamePin,
  submitted: (transaction: NativeTransaction) => void,
): Promise<void> {
  const codec = new CallData(local.games.sierra.abi);
  for (let next = releaseId + 1; next <= local.release.releaseId; next++) {
    const result = await account.execute(
      {
        contractAddress: local.games.address,
        entrypoint: "apply_release",
        calldata: codec.compile("apply_release", { game_id: gameId, release_id: next }),
      },
      { tip: 0 },
    );
    submitted({ action: "apply_release", domain: "games", hash: result.transaction_hash });
    await waitForSuccess(account, result.transaction_hash);
  }
}

async function requirePublishedReleases(local: NativeWorld, heraldUrl: string, pins: number[]): Promise<void> {
  const response = await fetch(`${heraldUrl.replace(/\/$/, "")}/manifest`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("NATIVE_HERALD_RELEASE_UNAVAILABLE: Herald manifest is unavailable");
  const manifest = (await response.json()) as {
    chainId: string;
    contracts: Record<string, string>;
    releaseSchemas: Record<string, string>;
  };
  if (
    BigInt(manifest.contracts?.games ?? 0) !== BigInt(local.games.address) ||
    !local.previous ||
    BigInt(manifest.chainId) !== BigInt(local.previous.shard.chainId)
  )
    throw new Error("NATIVE_HERALD_RELEASE_UNAVAILABLE: Herald serves a different shard");
  const first = Math.min(local.release.releaseId, ...pins);
  for (let releaseId = first; releaseId <= local.release.releaseId; releaseId++) {
    if (manifest.releaseSchemas?.[String(releaseId)] !== local.release.schema)
      throw new Error(`NATIVE_HERALD_RELEASE_UNAVAILABLE: publish release ${releaseId} to Herald before applying`);
  }
}
