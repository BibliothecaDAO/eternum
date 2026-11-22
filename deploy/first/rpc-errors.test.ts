import { expect, test } from "bun:test";
import { isContractRevert } from "./chain";

const refused = (reason: string, code = 40) => ({ code, message: "Contract error", data: { revert_error: reason } });
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
