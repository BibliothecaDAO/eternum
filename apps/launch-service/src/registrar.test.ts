import { Effect, Layer } from "effect";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Registrar } from "./registrar";
const mock = vi.hoisted(() => ({ account: vi.fn(), process: vi.fn(), nextDue: vi.fn() }));
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
vi.mock("./env", () => ({ decodeLaunchEnv: (env: unknown) => env }));
vi.mock("./launcher-deployment", () => ({
  LauncherDeployment: class {
    account = mock.account;
  },
  deploymentOperation: (operation: () => Promise<unknown>) => Effect.promise(operation),
}));
vi.mock("./store", () => ({
  D1LaunchStore: class {
    nextDue = mock.nextDue;
  },
  databaseLayer: () => Layer.empty,
}));
vi.mock("./executor", () => ({
  shardChainOf: () => async () => "0x1",
  launchTargetOf: () => ({}),
  launchExecutorLayer: () => Layer.empty,
  readLaunchShard: vi.fn(),
}));
vi.mock("./process-launch", () => ({ processNextLaunch: mock.process }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(1000);
  mock.account.mockRejectedValue(new Error("launcher_role_not_granted"));
  mock.process.mockReturnValue(Effect.void);
  mock.nextDue.mockResolvedValue(2000);
});
afterEach(() => vi.restoreAllMocks());
const setup = () => {
  const setAlarm = vi.fn(async (_at: number) => {});
  const registrar = new Registrar({ storage: { setAlarm } } as unknown as DurableObjectState, {
    DB: {},
    VALUE_IDENTITY: { shards: async () => [{ chainId: "0x1", url: "https://shard.test", status: "active" }] },
  });
  return { registrar, setAlarm };
};
it("keeps polling an ungranted launcher beyond platform retries without consuming due runs, then resumes", async () => {
  const f = setup();
  for (let tick = 0; tick < 8; tick++) await f.registrar.alarm();
  expect(f.setAlarm).toHaveBeenCalledTimes(8);
  expect(f.setAlarm).toHaveBeenLastCalledWith(31_000);
  expect(mock.process).not.toHaveBeenCalled();
  expect(mock.nextDue).not.toHaveBeenCalled();
  mock.account.mockResolvedValue("0x2");
  await f.registrar.alarm();
  expect(mock.process).toHaveBeenCalledOnce();
  expect(f.setAlarm).toHaveBeenLastCalledWith(2000);
});
it("does not hide unrelated deployment failures", async () => {
  const f = setup();
  mock.account.mockRejectedValue(new Error("launcher_chain_differs"));
  await expect(f.registrar.alarm()).rejects.toThrow("launcher_chain_differs");
  expect(f.setAlarm).not.toHaveBeenCalled();
  expect(mock.process).not.toHaveBeenCalled();
});
