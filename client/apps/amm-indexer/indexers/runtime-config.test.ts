// @vitest-environment node

import { describe, expect, it } from "vitest";

import { InvalidIndexerRuntimeConfigError, resolveIndexerRuntimeConfig } from "./runtime-config";

describe("resolveIndexerRuntimeConfig", () => {
  it("rejects an empty AMM address before indexing starts", () => {
    expect(() =>
      resolveIndexerRuntimeConfig({
        ammAddress: "",
        lordsAddress: "0x1",
      }),
    ).toThrowError(InvalidIndexerRuntimeConfigError);
  });

  it("rejects a zero-like LORDS address before indexing starts", () => {
    expect(() =>
      resolveIndexerRuntimeConfig({
        ammAddress: "0xabc",
        lordsAddress: "0x0",
      }),
    ).toThrowError(InvalidIndexerRuntimeConfigError);
  });

  it("accepts non-zero hex addresses", () => {
    expect(
      resolveIndexerRuntimeConfig({
        ammAddress: "0xabc",
        lordsAddress: "0xdef",
      }),
    ).toEqual({
      ammAddress: "0xabc",
      lordsAddress: "0xdef",
    });
  });
});
