// @vitest-environment node

import { describe, expect, it } from "vitest";

import { ToriiSetting } from "@/types";
import { LOCAL_TORII_URL, resolveToriiUrlForSetting, resolveUnavailableToriiFallbackSetting } from "./torii-setting";

describe("resolveToriiUrlForSetting", () => {
  it("uses localhost for the local loader setting", () => {
    expect(resolveToriiUrlForSetting(ToriiSetting.Local, "https://api.example.test/x/world/torii")).toBe(
      LOCAL_TORII_URL,
    );
  });

  it("uses the configured remote Torii for the remote setting", () => {
    expect(resolveToriiUrlForSetting(ToriiSetting.Remote, "https://api.example.test/x/world/torii")).toBe(
      "https://api.example.test/x/world/torii",
    );
  });
});

describe("resolveUnavailableToriiFallbackSetting", () => {
  it("keeps a production mainnet remote failure on the configured remote URL", () => {
    expect(
      resolveUnavailableToriiFallbackSetting(ToriiSetting.Remote, {
        chain: "mainnet",
        isDev: false,
      }),
    ).toBeNull();
  });

  it("allows remote Torii to fall back to local while developing", () => {
    expect(
      resolveUnavailableToriiFallbackSetting(ToriiSetting.Remote, {
        chain: "mainnet",
        isDev: true,
      }),
    ).toBe(ToriiSetting.Local);
  });

  it("allows remote Torii to fall back to local for local-chain builds", () => {
    expect(
      resolveUnavailableToriiFallbackSetting(ToriiSetting.Remote, {
        chain: "local",
        isDev: false,
      }),
    ).toBe(ToriiSetting.Local);
  });

  it("falls back to remote when an explicit local loader is unavailable", () => {
    expect(
      resolveUnavailableToriiFallbackSetting(ToriiSetting.Local, {
        chain: "mainnet",
        isDev: false,
      }),
    ).toBe(ToriiSetting.Remote);
  });
});
