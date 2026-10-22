import { Effect, Layer } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Registrar } from "./registrar";
const mock = vi.hoisted(() => ({
  account: vi.fn(),
  process: vi.fn(),
  nextDue: vi.fn(),
  target: vi.fn(),
  layer: vi.fn(),
  slotStore: vi.fn(),
  freeze: vi.fn(),
  nextFreeze: vi.fn(),
  launched: vi.fn(),
  manifest: vi.fn(),
  shard: vi.fn(),
  pins: new Map<number, number>(),
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
vi.mock("./launcher-account", () => ({ joinBotAccount: mock.account }));
vi.mock("./slot-store", () => ({
  D1SlotStore: class {
    constructor(...args: unknown[]) {
      mock.slotStore(...args);
    }
    freezeDueSlots = mock.freeze;
    nextFreeze = mock.nextFreeze;
  },
  FREEZE_RETRY_MS: 30_000,
}));
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
    currentRelease = async () => 2;
    gameRelease = async (gameId: number) => mock.pins.get(gameId)!;
    isSettled = async () => false;
    applyRelease = async (gameId: number, releaseId: number) => {
      mock.pins.set(gameId, releaseId);
      return `0x${gameId}${releaseId}`;
    };
  },
}));
vi.mock("./store", () => ({
  D1LaunchStore: class {
    nextDue = mock.nextDue;
    launchedGameIds = mock.launched;
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
  vi.spyOn(Date, "now").mockReturnValue(1000);
  mock.account.mockRejectedValue(new Error("launcher_approval_refused"));
  mock.process.mockReturnValue(Effect.void);
  mock.nextDue.mockResolvedValue(2000);
  mock.layer.mockReturnValue(Layer.empty);
  mock.freeze.mockResolvedValue(undefined);
  mock.nextFreeze.mockResolvedValue(null);
});
afterEach(() => vi.restoreAllMocks());
const setup = () => {
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
    IDENTITY: { shards: async () => [{ chainId: "0x1", url: "https://shard.test", status: "active" }] },
  });
  return { registrar, setAlarm };
};
it("retries a failed launcher join beyond platform retries without consuming due runs, then resumes", async () => {
  const f = setup();
  for (let tick = 0; tick < 8; tick++) await f.registrar.alarm();
  expect(f.setAlarm).toHaveBeenCalledTimes(8);
  expect(f.setAlarm).toHaveBeenLastCalledWith(31_000);
  expect(await f.registrar.joinFailures()).toEqual([
    { chainId: "0x1", code: "launcher_approval_refused", checkedAt: 1000 },
  ]);
  expect(mock.process).not.toHaveBeenCalled();
  expect(mock.nextDue).not.toHaveBeenCalled();
  // A closed slot still freezes while the launcher cannot join.
  expect(mock.freeze).toHaveBeenCalledTimes(8);
  mock.account.mockResolvedValue("0x2");
  await f.registrar.alarm();
  expect(await f.registrar.joinFailures()).toEqual([]);
  expect(mock.process).toHaveBeenCalledOnce();
  expect(mock.target).toHaveBeenCalledWith(expect.anything(), "0x2", expect.any(Function));
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

it("freezes every closed slot first, launches from that same read of the slot, and wakes at the next close", async () => {
  const f = setup();
  mock.account.mockResolvedValue("0x2");
  mock.nextFreeze.mockResolvedValue(1500);
  await f.registrar.alarm();
  expect(mock.freeze.mock.invocationCallOrder[0]).toBeLessThan(mock.process.mock.invocationCallOrder[0]!);
  const [, , , freezeResolver] = mock.slotStore.mock.calls[0]!;
  const [, launchResolver] = mock.layer.mock.calls[0]!;
  expect(launchResolver).toBe(freezeResolver);
  expect(f.setAlarm).toHaveBeenLastCalledWith(1500);
});

it("still launches when the freeze cannot read its database, and retries the freeze itself without the cron", async () => {
  const f = setup();
  mock.account.mockResolvedValue("0x2");
  mock.nextDue.mockResolvedValue(null);
  mock.freeze.mockRejectedValueOnce(new Error("d1_unavailable"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  await f.registrar.alarm();
  expect(mock.process).toHaveBeenCalledOnce();
  expect(f.setAlarm).toHaveBeenLastCalledWith(31_000);
  // The retry freezes; with no slot left unfrozen and no run due, nothing re-arms.
  await f.registrar.alarm();
  expect(mock.freeze).toHaveBeenCalledTimes(2);
  expect(f.setAlarm).toHaveBeenCalledOnce();
});

it("wakes again at once for a slot that closed while the alarm ran", async () => {
  const f = setup();
  mock.account.mockResolvedValue("0x2");
  mock.nextDue.mockResolvedValue(null);
  mock.nextFreeze.mockResolvedValue(900);
  await f.registrar.alarm();
  expect(f.setAlarm).toHaveBeenLastCalledWith(1000);
});

const RELEASE_MANIFEST = {
  chainId: "0x1",
  rpcUrl: "https://rpc.shard.test",
  contracts: { games: "0x9" },
  releaseSchemas: { "1": "0xs", "2": "0xs" },
};

it("advances each running Frontier game as the joined launcher and reports it", async () => {
  const f = setup();
  mock.account.mockResolvedValue("0x2");
  mock.manifest.mockResolvedValue(RELEASE_MANIFEST);
  mock.launched.mockResolvedValue([1]);
  mock.pins.set(1, 1);
  expect(await f.registrar.applyRelease(2)).toEqual({
    releaseId: 2,
    shards: [{ chainId: "0x1", releaseId: 2, games: [{ gameId: 1, from: 1, to: 2, transactions: ["0x12"] }] }],
  });
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
  mock.launched.mockResolvedValue([1]);
  mock.pins.set(1, 1);
  const launching = f.registrar.alarm();
  await vi.waitFor(() => expect(mock.account).toHaveBeenCalledOnce());
  const releasing = f.registrar.applyRelease(2);
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
  mock.launched.mockResolvedValue([1]);
  mock.pins.set(1, 1);
  await expect(f.registrar.applyRelease(3)).rejects.toThrow("release_not_registered");
  expect(mock.pins.get(1)).toBe(1);
});
