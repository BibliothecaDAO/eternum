import { describe, expect, test } from "bun:test";
import { readA23ReleaseAuthorizationVerification } from "../runtime/aws/wave0-release";

describe("Wave 0 release verification configuration", () => {
  test("loads a quorum and separately trusted signer keys", () => {
    expect(
      readA23ReleaseAuthorizationVerification({
        A23_RELEASE_AUTHORITY_PUBLIC_KEYS_JSON: JSON.stringify({ "release-authority-1": "public-key" }),
        A23_RELEASE_SIGNATURE_QUORUM: "1",
      }),
    ).toEqual({
      requiredSignatureCount: 1,
      trustedSignerPublicKeys: { "release-authority-1": "public-key" },
    });
  });

  test("allows an unsigned STOP deployment but rejects partial or malformed GO policy", () => {
    expect(readA23ReleaseAuthorizationVerification({})).toBeUndefined();
    expect(() => readA23ReleaseAuthorizationVerification({ A23_RELEASE_SIGNATURE_QUORUM: "1" })).toThrow(
      "requires both",
    );
    expect(() =>
      readA23ReleaseAuthorizationVerification({
        A23_RELEASE_AUTHORITY_PUBLIC_KEYS_JSON: "{}",
        A23_RELEASE_SIGNATURE_QUORUM: "0",
      }),
    ).toThrow("must contain non-empty signer IDs and public keys");
  });
});
