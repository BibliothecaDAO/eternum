import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  assertProductionReleaseAuthorized,
  buildA23ReleaseAuthorizationMessage,
  type A23ReleaseAuthorizationVerification,
} from "../game-stack";

describe("Wave 0 production release authorization", () => {
  test("fails closed for the current unsigned A23 STOP shape", () => {
    expect(() =>
      assertProductionReleaseAuthorized({
        schemaVersion: 1,
        ticket: "A23",
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
        schemaVersion: 1,
        ticket: "A23",
        decision: "GO",
        releaseReady: true,
        productionStartAuthorized: true,
        authorization: { status: "authorized", signatures: [{ signer: "release-authority" }] },
      }),
    ).toThrow("requires a cryptographically verified A23 authorization artifact");
  });

  test("accepts a GO record signed by the configured release authority", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const decision = goDecision();
    const signature = sign(null, buildA23ReleaseAuthorizationMessage(decision), privateKey).toString("base64");
    decision.authorization.signatures.push({
      signerId: "release-authority-1",
      scheme: "ed25519",
      signatureBase64: signature,
    });

    expect(() =>
      assertProductionReleaseAuthorized(decision, {
        requiredSignatureCount: 1,
        trustedSignerPublicKeys: {
          "release-authority-1": publicKey.export({ type: "spki", format: "pem" }).toString(),
        },
      }),
    ).not.toThrow();
  });

  test("rejects an unknown signer, a changed decision, and an unmet quorum", () => {
    const authority = generateKeyPairSync("ed25519");
    const otherAuthority = generateKeyPairSync("ed25519");
    const decision = goDecision();
    decision.authorization.signatures.push({
      signerId: "release-authority-1",
      scheme: "ed25519",
      signatureBase64: sign(null, buildA23ReleaseAuthorizationMessage(decision), authority.privateKey).toString(
        "base64",
      ),
    });
    const verification: A23ReleaseAuthorizationVerification = {
      requiredSignatureCount: 1,
      trustedSignerPublicKeys: {
        "release-authority-2": otherAuthority.publicKey.export({ type: "spki", format: "pem" }).toString(),
      },
    };

    expect(() => assertProductionReleaseAuthorized(decision, verification)).toThrow(
      "does not satisfy the configured signature quorum",
    );

    verification.trustedSignerPublicKeys["release-authority-1"] = authority.publicKey
      .export({ type: "spki", format: "pem" })
      .toString();
    decision.decisionReason = "changed after signature";
    expect(() => assertProductionReleaseAuthorized(decision, verification)).toThrow(
      "does not satisfy the configured signature quorum",
    );

    decision.decisionReason = "All mandatory Wave 0 evidence is complete.";
    verification.requiredSignatureCount = 2;
    expect(() => assertProductionReleaseAuthorized(decision, verification)).toThrow(
      "does not satisfy the configured signature quorum",
    );
  });

  test("rejects duplicate signer identities and malformed verification policy", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const decision = goDecision();
    const signature = sign(null, buildA23ReleaseAuthorizationMessage(decision), privateKey).toString("base64");
    decision.authorization.signatures.push(
      { signerId: "release-authority-1", scheme: "ed25519", signatureBase64: signature },
      { signerId: "release-authority-1", scheme: "ed25519", signatureBase64: signature },
    );
    const verification = {
      requiredSignatureCount: 2,
      trustedSignerPublicKeys: {
        "release-authority-1": publicKey.export({ type: "spki", format: "pem" }).toString(),
      },
    } satisfies A23ReleaseAuthorizationVerification;

    expect(() => assertProductionReleaseAuthorized(decision, verification)).toThrow(
      "contains a duplicate signer identity",
    );
    expect(() =>
      assertProductionReleaseAuthorized(goDecision(), {
        requiredSignatureCount: 0,
        trustedSignerPublicKeys: {},
      }),
    ).toThrow("requires a positive signature quorum");
  });
});

function goDecision() {
  return {
    schemaVersion: 1,
    ticket: "A23",
    decision: "GO",
    decisionReason: "All mandatory Wave 0 evidence is complete.",
    releaseReady: true,
    productionStartAuthorized: true,
    authorization: {
      status: "authorized",
      signatures: [] as Array<{ signerId: string; scheme: string; signatureBase64: string }>,
    },
  };
}
