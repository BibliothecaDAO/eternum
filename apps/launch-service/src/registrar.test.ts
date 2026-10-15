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
  nextClose: vi.fn(),
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
    nextClose = mock.nextClose;
  },
}));
vi.mock("./store", () => ({
  D1LaunchStore: class {
    nextDue = mock.nextDue;
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
  mock.nextClose.mockResolvedValue(null);
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
  mock.nextClose.mockResolvedValue(1500);
  await f.registrar.alarm();
  expect(mock.freeze.mock.invocationCallOrder[0]).toBeLessThan(mock.process.mock.invocationCallOrder[0]!);
  const [, , , freezeResolver] = mock.slotStore.mock.calls[0]!;
  const [, launchResolver] = mock.layer.mock.calls[0]!;
  expect(launchResolver).toBe(freezeResolver);
  expect(f.setAlarm).toHaveBeenLastCalledWith(1500);
});

it("still launches when the freeze cannot read its database", async () => {
  const f = setup();
  mock.account.mockResolvedValue("0x2");
  mock.freeze.mockRejectedValue(new Error("d1_unavailable"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  await f.registrar.alarm();
  expect(mock.process).toHaveBeenCalledOnce();
});
