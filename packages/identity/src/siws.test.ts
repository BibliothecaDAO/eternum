import { describe, expect, it } from "vitest";

import { buildSiwsMessage, parseSiwsTypedData, SIWS_TYPES } from "./siws";

const options = {
  address: "0x0123",
  chainId: "SN_MAIN" as const,
  domain: "realms.test",
  nonce: "a".repeat(64), // server nonces are 32 random bytes hex-encoded
  uri: "https://realms.test",
  issuedAt: "2026-08-26T12:00:00.000Z",
};

describe("siws typed data", () => {
  it("builds canonical revision-1 typed data (shortstring domain)", () => {
    const message = buildSiwsMessage(options);
    expect(message.types).toEqual(SIWS_TYPES);
    expect(message.domain).toEqual({ name: "realms.test", version: "0.0.1", chainId: "SN_MAIN", revision: "1" });
    for (const member of message.types.StarknetDomain) expect(member.type).toBe("shortstring");
  });

  it("round-trips through the server parser", () => {
    const message = buildSiwsMessage(options);
    expect(parseSiwsTypedData(JSON.stringify(message))).toEqual(message);
  });

  it("refuses tampered type definitions", () => {
    const message = buildSiwsMessage(options) as unknown as { types: { StarknetDomain: { type: string }[] } };
    message.types = JSON.parse(JSON.stringify(message.types));
    message.types.StarknetDomain[0]!.type = "string";
    expect(() => parseSiwsTypedData(JSON.stringify(message))).toThrow(/canonical revision 1/);
  });

  it("refuses unknown fields and oversized shortstrings", () => {
    const message = buildSiwsMessage(options);
    expect(() => parseSiwsTypedData(JSON.stringify({ ...message, domain: { ...message.domain, extra: "x" } }))).toThrow(
      /not part of the message/,
    );
    expect(() => buildSiwsMessage({ ...options, domain: "d".repeat(40) })).toThrow(/shortstring/);
  });
});
