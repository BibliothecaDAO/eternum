import { expect, test } from "bun:test";
import { type RpcProvider } from "starknet";
import { isContractRevert } from "./chain";
import { setupCalls, setupPresenceReader } from "./ledger";
import { environments } from "./settings";

const assets = { ledger: "0x10", lords: "0x11", mmr: "0x12", chests: "0x13", cosmetics: "0x14" };
const refused = (reason: string, code = 40) => ({ code, message: "Contract error", data: { revert_error: reason } });
test("a fresh ledger's preset read reports missing on an RPC contract error", async () => {
  const reason = "Ledger: unknown preset";
  const operation = setupCalls(environments.dev, assets, "0x33").find(
    (call) => call.entrypoint === "register_preset",
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

test("recognizes the live node's felt-encoded Frontier refusal without matching other contract failures", () => {
  const encoded =
    "0x46a6158a16a947e5916b2a2ca68501a45e93d7110e81aa2d6438b1c57c879a3, 0x1, 0x4c65646765723a20756e6b6e6f776e2046726f6e7469657220736561736f6e, 0x0, 0x0";
  expect(isContractRevert({ baseError: refused(encoded) }, "Ledger: unknown Frontier season")).toBe(true);
  expect(isContractRevert({ baseError: refused(encoded, 41) }, "Ledger: unknown Frontier season")).toBe(false);
  expect(isContractRevert({ baseError: refused(encoded) }, "Ledger: paused")).toBe(false);
});
