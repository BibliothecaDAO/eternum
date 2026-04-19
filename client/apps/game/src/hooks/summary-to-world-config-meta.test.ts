// @vitest-environment node
import type { WorldSummary } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { summaryToWorldConfigMeta } from "./summary-to-world-config-meta";

const baseSummary: WorldSummary = {
  name: "alpha",
  chain: "mainnet",
  alive: true,
  lastCheckedAt: 0,
  mode: "blitz",
  startSettlingAt: 100,
  startMainAt: 200,
  endAt: 1200,
  devModeOn: false,
  mmrEnabled: true,
  singleRealmMode: false,
  twoPlayerMode: false,
  seasonPassAddress: "0xseason",
  villagePassAddress: "0xvillage",
  prizeDistributionAddress: "0xprize",
  feeTokenAddress: "0xfee",
  registrationCount: 5,
  registrationCountMax: 100,
  settledPlayersCount: null,
  settledRealmsCount: null,
  settledVillagesCount: null,
  numHyperstructuresLeft: 42,
  winnerJackpotAmount: "999",
};

describe("summaryToWorldConfigMeta", () => {
  it("maps blitz-mode summary fields into the legacy meta shape", () => {
    const meta = summaryToWorldConfigMeta(baseSummary, null);

    expect(meta.mode).toBe("blitz");
    expect(meta.startSettlingAt).toBe(100);
    expect(meta.startMainAt).toBe(200);
    expect(meta.endAt).toBe(1200);
    expect(meta.seasonDurationSeconds).toBe(1000);
    expect(meta.registrationCount).toBe(5);
    expect(meta.registrationCountMax).toBe(100);
    expect(meta.seasonPassAddress).toBe("0xseason");
    expect(meta.villagePassAddress).toBe("0xvillage");
    expect(meta.prizeDistributionAddress).toBe("0xprize");
    expect(meta.feeTokenAddress).toBe("0xfee");
    expect(meta.numHyperstructuresLeft).toBe(42);
    expect(meta.mmrEnabled).toBe(true);
    expect(meta.devModeOn).toBe(false);
  });

  it("leaves winnerJackpotAmount at 0n — jackpot is resolved via useWorldJackpot", () => {
    const meta = summaryToWorldConfigMeta(baseSummary, null);
    expect(meta.winnerJackpotAmount).toBe(0n);
  });

  it("resolves eternum mode for eternum summaries", () => {
    const meta = summaryToWorldConfigMeta({ ...baseSummary, mode: "eternum" }, null);
    expect(meta.mode).toBe("eternum");
  });

  it("resolves unknown mode for null or unknown summary.mode", () => {
    expect(summaryToWorldConfigMeta({ ...baseSummary, mode: null }, null).mode).toBe("unknown");
    expect(summaryToWorldConfigMeta({ ...baseSummary, mode: "unknown" }, null).mode).toBe("unknown");
  });

  it("defaults isPlayerRegistered and hasPlayerSettledRealm to null when no registration passed", () => {
    const meta = summaryToWorldConfigMeta(baseSummary, null);
    expect(meta.isPlayerRegistered).toBeNull();
    expect(meta.hasPlayerSettledRealm).toBeNull();
  });

  it("threads player registration through when provided", () => {
    const meta = summaryToWorldConfigMeta(baseSummary, {
      isPlayerRegistered: true,
      hasPlayerSettledRealm: false,
    });
    expect(meta.isPlayerRegistered).toBe(true);
    expect(meta.hasPlayerSettledRealm).toBe(false);
  });

  it("null-safes all nullable summary fields to reasonable defaults", () => {
    const summary: WorldSummary = {
      ...baseSummary,
      mode: null,
      startSettlingAt: null,
      startMainAt: null,
      endAt: null,
      devModeOn: null,
      mmrEnabled: null,
      singleRealmMode: null,
      twoPlayerMode: null,
      seasonPassAddress: null,
      villagePassAddress: null,
      prizeDistributionAddress: null,
      feeTokenAddress: null,
      registrationCount: null,
      registrationCountMax: null,
      settledPlayersCount: null,
      settledRealmsCount: null,
      settledVillagesCount: null,
      numHyperstructuresLeft: null,
      winnerJackpotAmount: null,
    };

    const meta = summaryToWorldConfigMeta(summary, null);

    expect(meta.mode).toBe("unknown");
    expect(meta.startMainAt).toBeNull();
    expect(meta.endAt).toBeNull();
    expect(meta.seasonDurationSeconds).toBeNull();
    expect(meta.mmrEnabled).toBe(false);
    expect(meta.devModeOn).toBe(false);
    expect(meta.singleRealmMode).toBe(false);
    expect(meta.twoPlayerMode).toBe(false);
    expect(meta.prizeDistributionAddress).toBeNull();
    expect(meta.feeTokenAddress).toBeNull();
    expect(meta.numHyperstructuresLeft).toBeNull();
    expect(meta.winnerJackpotAmount).toBe(0n);
  });

  it("threads eternum settlement counts from the summary", () => {
    const summary: WorldSummary = {
      ...baseSummary,
      mode: "eternum",
      settledPlayersCount: 12,
      settledRealmsCount: 34,
      settledVillagesCount: 56,
    };

    const meta = summaryToWorldConfigMeta(summary, null);

    expect(meta.settledPlayersCount).toBe(12);
    expect(meta.settledRealmsCount).toBe(34);
    expect(meta.settledVillagesCount).toBe(56);
  });

  it("sets registrationEndAt to startMainAt (registration ends when main starts)", () => {
    const meta = summaryToWorldConfigMeta(baseSummary, null);
    expect(meta.registrationEndAt).toBe(baseSummary.startMainAt);
  });
});
