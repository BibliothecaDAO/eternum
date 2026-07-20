import { describe, expect, test } from "bun:test";
import { assertProductionReleaseAuthorized } from "../game-stack";

describe("Wave 0 production release authorization", () => {
  test("fails closed for the current unsigned A23 STOP shape", () => {
    expect(() =>
      assertProductionReleaseAuthorized({
        decision: "STOP",
        releaseReady: false,
        productionStartAuthorized: false,
        authorization: { status: "awaiting-authorized-signatures", signatures: [] },
      }),
    ).toThrow("blocked by the current A23 Wave 0 release decision");
  });

  test("rejects a structurally spoofed GO record without cryptographic verification", () => {
    expect(() =>
      assertProductionReleaseAuthorized({
        decision: "GO",
        releaseReady: true,
        productionStartAuthorized: true,
        authorization: { status: "authorized", signatures: [{ signer: "release-authority" }] },
      }),
    ).toThrow("requires a cryptographically verified A23 authorization artifact");
  });
});
