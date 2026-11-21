import { Effect, Layer } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Registrar } from "./registrar";
import { releaseLine } from "../../../packages/core/src/test-support/releases";
const mock = vi.hoisted(() => ({
  account: vi.fn(),
  process: vi.fn(),
  nextDue: vi.fn(),
  target: vi.fn(),
  layer: vi.fn(),
  launched: vi.fn(),
  manifest: vi.fn(),
  shard: vi.fn(),
  pins: new Map<number, number>(),
  open: 1,
}));
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
vi.mock("./env", () => ({ decodeLaunchEnv: (env: unknown) => env }));
vi.mock("./launcher-account", () => ({ joinLauncherAccount: mock.account }));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  readRegisteredShard: mock.manifest,
}));
vi.mock("./shard-client", () => ({
  // The launcher's view of the shard: release 2 registered, each game at its pin in `mock.pins`.
  LaunchShard: class {
    constructor(target: unknown) {
      mock.shard(target);
    }
    openReleaseOf = async () => mock.open;
    latestReleaseOf = async () => 2;
    releaseRegistered = async (releaseId: number) => releaseId <= 2;
    openRelease = async (releaseId: number) => {
      mock.open = releaseId;
      return `0x0${releaseId}`;
    };
    registeredRelease = async (releaseId: number) => ({
      logic: ["0x55e0", "0x77a2"],
      migration: "0x0",
      family: 1,
      previous: releaseId - 1,
    });
    gameId = async (name: string) => (name === "frontier-1" ? 1 : 0);
    gameRelease = async (gameId: number) => mock.pins.get(gameId)!;
    game = async () => ({ settled: false, family: 1n });
    applyRelease = async (gameId: number, releaseId: number) => {
      mock.pins.set(gameId, releaseId);
      return `0x${gameId}${releaseId}`;
    };
  },
}));
vi.mock("./store", () => ({
  D1LaunchStore: class {
    nextDue = mock.nextDue;
    gameNames = mock.launched;
  },
  databaseLayer: () => Layer.empty,
}));
vi.mock("./executor", () => ({
  shardChainOf: () => async () => "0x1",
  launchTargetOf: mock.target,
  launchExecutorLayer: mock.layer,
  readLaunchShard: vi.fn(),
}));
vi.mock("./process-launch", () => ({ processNextLaunch: mock.process }));
beforeEach(() => {
  vi.clearAllMocks();
  mock.open = 1;
  vi.spyOn(Date, "now").mockReturnValue(1000);
  mock.account.mockRejectedValue(new Error("launcher_approval_refused"));
  mock.process.mockReturnValue(Effect.void);
  mock.nextDue.mockResolvedValue(2000);
  mock.layer.mockReturnValue(Layer.empty);
});
afterEach(() => vi.restoreAllMocks());
const setup = (shard: { chainId: string; url: string } | null = { chainId: "0x1", url: "https://shard.test" }) => {
  const setAlarm = vi.fn(async (_at: number) => {});
  const values = new Map<string, unknown>();
  const context = {
    storage: {
      setAlarm,
      getAlarm: async () => null,
      get: async (key: string) => values.get(key),
      put: async (key: string, value: unknown) => {
        values.set(key, value);
      },
    },
  };
  const registrar = new Registrar(context as unknown as DurableObjectState, {
    DB: {},
    IDENTITY: { shard: async () => shard },
  });
  return { registrar, setAlarm };
};
it("retries a failed launcher join beyond platform retries without consuming due runs, then resumes", async () => {
  const f = setup();
  for (let tick = 0; tick < 8; tick++) await f.registrar.alarm();
  expect(f.setAlarm).toHaveBeenCalledTimes(8);
  expect(f.setAlarm).toHaveBeenLastCalledWith(31_000);
  expect(await f.registrar.joinFailure()).toEqual({
    chainId: "0x1",
    code: "launcher_approval_refused",
    checkedAt: 1000,
  });
  expect(mock.process).not.toHaveBeenCalled();
  expect(mock.nextDue).not.toHaveBeenCalled();
  mock.account.mockResolvedValue("0x2");
  await f.registrar.alarm();
  expect(await f.registrar.joinFailure()).toBeNull();
  expect(mock.process).toHaveBeenCalledOnce();
  expect(mock.target).toHaveBeenCalledWith(expect.anything(), "0x2");
  expect(f.setAlarm).toHaveBeenLastCalledWith(2000);
});
it("retries other account failures without consuming due runs", async () => {
  const f = setup();
  mock.account.mockRejectedValue(new Error("launcher_chain_differs"));
  await f.registrar.alarm();
  expect(f.setAlarm).toHaveBeenLastCalledWith(31_000);
  expect(mock.process).not.toHaveBeenCalled();
});

it("reports an executing alarm as awake even after its stored alarm has fired", async () => {
  const f = setup();
  let finish!: (address: string) => void;
  mock.account.mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const processing = f.registrar.alarm();
  await vi.waitFor(() => expect(mock.account).toHaveBeenCalled());
  expect(await f.registrar.wakeAt()).toBe(1000);
  finish("0x2");
  await processing;
  expect(await f.registrar.wakeAt()).toBeNull();
});

const RELEASE = {
  releaseId: 2,
  schema: "0xs",
  logic: { season: "0x55e0", troops: "0x77a2" },
  migration: "0x0",
};
const RELEASE_MANIFEST = {
  chainId: "0x1",
  rpcUrl: "https://rpc.shard.test",
  contracts: { games: "0x9" },
  releases: releaseLine(RELEASE.schema, [1, 2]),
};
const SHARD = { chainId: "0x1", url: "https://shard.test" };

it("advances each running Frontier game as the joined launcher, then opens the release for new games", async () => {
  const f = setup();
  mock.account.mockResolvedValue("0x2");
  mock.manifest.mockResolvedValue(RELEASE_MANIFEST);
  mock.launched.mockResolvedValue(["frontier-1"]);
  mock.pins.set(1, 1);
  expect(await f.registrar.applyRelease(RELEASE, SHARD)).toEqual({
    shard: {
      chainId: "0x1",
      releaseId: 2,
      games: [{ gameId: 1, from: 1, to: 2, transactions: ["0x12"] }],
      opened: ["0x02"],
    },
  });
  expect(mock.open).toBe(2);
  expect(mock.pins.get(1)).toBe(2);
  const [deployed, chain] = mock.manifest.mock.calls[0]!;
  expect(chain).toBe("0x1");
  expect(await deployed.shard()).toEqual(SHARD);
  expect(mock.account).toHaveBeenCalledWith(expect.anything(), deployed, "0x1");
  expect(mock.launched).toHaveBeenCalledWith("madara.frontier");
  expect(mock.shard).toHaveBeenCalledWith(
    expect.objectContaining({ accountAddress: "0x2", gamesAddress: "0x9", rpcUrl: "https://rpc.shard.test" }),
  );
});

it("waits for a running launch before the launcher applies a release", async () => {
  const f = setup();
  let finish!: (address: string) => void;
  mock.account.mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  mock.account.mockResolvedValue("0x2");
  mock.manifest.mockResolvedValue(RELEASE_MANIFEST);
  mock.launched.mockResolvedValue(["frontier-1"]);
  mock.pins.set(1, 1);
  const launching = f.registrar.alarm();
  await vi.waitFor(() => expect(mock.account).toHaveBeenCalledOnce());
  const releasing = f.registrar.applyRelease(RELEASE, SHARD);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(mock.shard).not.toHaveBeenCalled();
  finish("0x2");
  await launching;
  await releasing;
  expect(mock.process.mock.invocationCallOrder[0]).toBeLessThan(mock.shard.mock.invocationCallOrder[0]!);
});

it("refuses by name and sends nothing when the box half has not registered the release", async () => {
  const f = setup();
  mock.account.mockResolvedValue("0x2");
  mock.manifest.mockResolvedValue(RELEASE_MANIFEST);
  mock.launched.mockResolvedValue(["frontier-1"]);
  mock.pins.set(1, 1);
  await expect(f.registrar.applyRelease({ ...RELEASE, releaseId: 3 }, SHARD)).rejects.toThrow("release_not_registered");
  expect(mock.pins.get(1)).toBe(1);
  expect(mock.open).toBe(1);
});

it("refuses a release step without the commit's release while a shard is active, before joining the launcher", async () => {
  const f = setup();
  await expect(f.registrar.applyRelease(null, SHARD)).rejects.toThrow("release_unverified");
  expect(mock.account).not.toHaveBeenCalled();
  expect(mock.shard).not.toHaveBeenCalled();
});

it("answers no shard to a first deployment's release step, before any shard is active", async () => {
  const f = setup(null);
  expect(await f.registrar.applyRelease(null, null)).toEqual({ shard: null });
  expect(mock.account).not.toHaveBeenCalled();
});

it("refuses a release step whose shard is not the chain its Herald serves, before the launcher joins", async () => {
  const f = setup();
  const ledger = await vi.importActual<typeof import("@realms-world/value-ledger")>("@realms-world/value-ledger");
  mock.manifest.mockImplementation(ledger.readRegisteredShard);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ...RELEASE_MANIFEST, version: 1, chainId: "0x2" }));
  mock.pins.set(1, 1);
  await expect(f.registrar.applyRelease(RELEASE, SHARD)).rejects.toThrow("directory_manifest_chain_differs");
  expect(mock.account).not.toHaveBeenCalled();
  expect(mock.shard).not.toHaveBeenCalled();
  expect(mock.pins.get(1)).toBe(1);
});
