import { ec, hash, outsideExecution, typedData } from "starknet";
import { describe, expect, it } from "vitest";

import { createGuardian, walletExecutionMessage, WalletSelfCallError, type WalletExecution } from "./guardian";

const KEY = "0x2dccce1da22003777062ee0870e9881b460a8b7eca276870f57c601f182136c";
const CHAIN = "0x534e5f4d41494e";
const WALLET = "0x35efade21eb19a6c67fb463480ceaafc2a79423993c3f8cb0fad6a05cd517e9";
const LORDS = "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";

const execution = (to: string): WalletExecution => ({
  caller: "0x414e595f43414c4c4552",
  nonce: "0x7",
  executeAfter: "0x1",
  executeBefore: "0x6a000000",
  calls: [{ to, selector: hash.getSelectorFromName("transfer"), calldata: ["0x1", "0x5", "0x0"] }],
});

describe("guardian co-signature on a default wallet", () => {
  it("signs the outside execution's SNIP-12 hash for that wallet with the guardian key", async () => {
    const guardian = createGuardian(KEY);
    const signature = await guardian.signWalletExecution(CHAIN, WALLET, execution(LORDS));
    const digest = typedData.getMessageHash(walletExecutionMessage(CHAIN, execution(LORDS)), WALLET);
    const point = ec.starkCurve.getPublicKey(KEY);
    expect(
      ec.starkCurve.verify(new ec.starkCurve.Signature(BigInt(signature.r), BigInt(signature.s)), digest, point),
    ).toBe(true);
  });

  it("hashes as starknet.js's own execute_from_outside_v2 message", () => {
    const reference = outsideExecution.getTypedData(
      CHAIN,
      { caller: "0x414e595f43414c4c4552", execute_after: 1, execute_before: 0x6a000000 },
      "0x7",
      [{ contractAddress: LORDS, entrypoint: "transfer", calldata: ["0x1", "0x5", "0x0"] }],
      "2",
    );
    expect(typedData.getMessageHash(walletExecutionMessage(CHAIN, execution(LORDS)), WALLET)).toBe(
      typedData.getMessageHash(reference, WALLET),
    );
  });

  const selfCall = (entrypoint: string, extra: WalletExecution["calls"] = []): WalletExecution => ({
    ...execution(LORDS),
    calls: [{ to: WALLET, selector: hash.getSelectorFromName(entrypoint), calldata: [] }, ...extra],
  });

  it("refuses every other call to the wallet itself: owner, guardian and upgrade changes", async () => {
    for (const entrypoint of ["transfer", "change_owners", "change_guardians", "trigger_escape_guardian", "upgrade"])
      await expect(createGuardian(KEY).signWalletExecution(CHAIN, WALLET, selfCall(entrypoint))).rejects.toThrow(
        WalletSelfCallError,
      );
  });

  it("takes part in a recovery step only when it is the execution's one call", async () => {
    const guardian = createGuardian(KEY);
    for (const entrypoint of ["trigger_escape_owner", "escape_owner", "cancel_escape"]) {
      await expect(guardian.signWalletExecution(CHAIN, WALLET, selfCall(entrypoint))).resolves.toHaveProperty("r");
      await expect(
        guardian.signWalletExecution(CHAIN, WALLET, selfCall(entrypoint, execution(LORDS).calls)),
      ).rejects.toThrow(WalletSelfCallError);
    }
  });
});
