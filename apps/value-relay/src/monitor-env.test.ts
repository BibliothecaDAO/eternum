import { expect, it, vi } from "vitest";
import worker from "./monitor-worker";
import { decodeMonitorSettings } from "./monitor-env";
vi.mock("cloudflare:workers", () => ({ WorkerEntrypoint: class {}, DurableObject: class {} }));
const settings = {
  ENVIRONMENT: "staging",
  L2_RPC_URL: "https://ledger.test",
  OPERATOR_TOKEN: "test-token",
  PAUSER_ACCOUNT_ADDRESS: "0x2",
  PAUSER_PRIVATE_KEY: "0x3",
};
it.each(Object.keys(settings))("rejects missing %s before health or scheduled work starts", async (name) => {
  const get = vi.fn();
  const env = { ...settings, [name]: undefined, MONITOR: { get } } as never;
  await expect(worker.fetch(new Request("https://play.test/api/operator/monitor/health"), env)).rejects.toThrow(
    "monitor_environment_invalid",
  );
  await expect(worker.scheduled({} as ScheduledController, env)).rejects.toThrow("monitor_environment_invalid");
  expect(get).not.toHaveBeenCalled();
});
it("requires the canonical HTTPS RPC without exposing configuration values", () => {
  expect(decodeMonitorSettings(settings)).toEqual(settings);
  expect(() =>
    decodeMonitorSettings({ ...settings, L2_RPC_URL: undefined, LEDGER_RPC_URL: settings.L2_RPC_URL }),
  ).toThrow("monitor_environment_invalid");
  expect(() => decodeMonitorSettings({ ...settings, L2_RPC_URL: "http://private-secret" })).toThrow(
    /^monitor_environment_invalid$/,
  );
});
it.each([true, false])("serves health under the existing monitor route (healthy: %s)", async (success) => {
  const health = { success, checked_at: Math.floor(Date.now() / 1000) };
  const env = {
    ...settings,
    MONITOR: { idFromName: (name: string) => name, get: () => ({ health: async () => health }) },
  } as never;
  const reply = await worker.fetch(new Request("https://play.test/api/operator/monitor/health"), env);
  expect(reply.status).toBe(success ? 200 : 503);
  expect(await reply.json()).toEqual({ service: "value-monitor", ...health });
  expect(reply.headers.get("cache-control")).toBe("no-store");
  expect((await worker.fetch(new Request("https://play.test/health"), env)).status).toBe(404);
});
