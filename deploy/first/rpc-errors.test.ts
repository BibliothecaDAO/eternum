import { expect, test } from "bun:test";
import { type RpcProvider } from "starknet";
import { isContractRevert } from "./chain";
import { setupCalls, setupPresenceReader } from "./ledger";
import { environments } from "./settings";

const assets = { ledger: "0x10", lords: "0x11", mmr: "0x12", chests: "0x13", cosmetics: "0x14" };
const refused = (reason: string, code = 40) => ({ code, message: "Contract error", data: { revert_error: reason } });
test.each([
  ["register_preset", "Ledger: unknown preset"],
  ["open_season", "Ledger: unknown Blitz season"],
])("a fresh ledger's %s read reports missing on an RPC contract error", async (entrypoint, reason) => {
  const operation = setupCalls(environments.dev, assets, "0x33", 4000, 9000).find(
    (call) => call.entrypoint === entrypoint,
  )!;
  const provider = {
    callContract: async () => {
      throw refused(reason);
    },
  } as unknown as RpcProvider;
  expect(await setupPresenceReader(provider)(operation, 5)).toBe(false);
  provider.callContract = async () => {
    throw refused(reason, 41);
  };
  await expect(setupPresenceReader(provider)(operation, 5)).rejects.toEqual(refused(reason, 41));
});
test("the unfunded Frontier read uses the same contract error and exact refusal", async () => {
  const reason = "Ledger: unknown Frontier season";
  const read = async () => {
    throw { cause: refused(reason) };
  };
  try {
    await read();
    throw new Error("Expected refusal");
  } catch (error) {
    expect(isContractRevert(error, reason)).toBe(true);
  }
  expect(isContractRevert(refused("Ledger: paused"), reason)).toBe(false);
  expect(isContractRevert(refused(reason, 41), reason)).toBe(false);
  expect(isContractRevert({ code: 20 }, reason)).toBe(false);
});
