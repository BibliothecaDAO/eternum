import { expect, it, vi } from "vitest";
import worker from "./worker";
import { decodeRelaySettings } from "./environment";
vi.mock("cloudflare:workers", () => ({ WorkerEntrypoint: class {}, DurableObject: class {} }));
const settings = {
  ENVIRONMENT: "staging",
  BASE_URL: "https://play.dev-realms.party",
  L2_RPC_URL: "https://ledger.test",
  OPERATOR_TOKEN: "test-token",
  SHARD_LEDGER_OPERATOR_PRIVATE_KEY: "0x1",
  LEDGER_OPERATOR_ADDRESS: "0x2",
  LEDGER_OPERATOR_PRIVATE_KEY: "0x3",
};
it.each(Object.keys(settings))("rejects missing %s before health or scheduled work starts", async (name) => {
  const get = vi.fn();
  const env = { ...settings, [name]: undefined, RELAY: { get } } as never;
  await expect(worker.fetch(new Request(settings.BASE_URL + "/api/value/health"), env)).rejects.toThrow(
    "relay_environment_invalid",
  );
  await expect(worker.scheduled({} as ScheduledController, env)).rejects.toThrow("relay_environment_invalid");
  expect(get).not.toHaveBeenCalled();
});
it("requires the canonical HTTPS RPC without exposing configuration values", () => {
  expect(decodeRelaySettings(settings)).toEqual(settings);
  expect(() =>
    decodeRelaySettings({ ...settings, L2_RPC_URL: undefined, LEDGER_RPC_URL: settings.L2_RPC_URL }),
  ).toThrow("relay_environment_invalid");
  expect(() => decodeRelaySettings({ ...settings, L2_RPC_URL: "http://private-secret" })).toThrow(
    /^relay_environment_invalid$/,
  );
});
it.each([true, false])("serves health under the existing value route (healthy: %s)", async (success) => {
  const health = { service: "value-relay", success, checked_at: Math.floor(Date.now() / 1000) };
  const env = {
    ...settings,
    IDENTITY: { shards: async () => [] },
    RELAY: { idFromName: (name: string) => name, get: () => ({ ledgerHealth: async () => health }) },
  } as never;
  const reply = await worker.fetch(new Request(settings.BASE_URL + "/api/value/health"), env);
  expect(reply.status).toBe(success ? 200 : 503);
  expect(await reply.json()).toEqual({ ...health, shards: [], held: [] });
  expect(reply.headers.get("cache-control")).toBe("no-store");
  expect((await worker.fetch(new Request(settings.BASE_URL + "/health"), env)).status).toBe(404);
});
