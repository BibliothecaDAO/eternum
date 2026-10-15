import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { configManager, getBlockTimestamp, ResourceManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { bindChainTime } from "./chain-time-binding";
import { createGameSyncObserver } from "./game-sync-observer";

const HEAD_SECONDS = 1_787_000_000;

beforeEach(() => {
  vi.spyOn(configManager, "getTick").mockReturnValue(1);
  useChainTimeStore.setState({
    lastHeartbeat: null,
    executionFloorMs: null,
    anchorTimestampMs: null,
    anchorPerfMs: null,
    nowMs: null,
  });
});
afterEach(() => {
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

it("has no chain time before a confirmed head, and never guesses one from the local clock", () => {
  bindChainTime();
  expect(useChainTimeStore.getState().nowMs).toBeNull();
  expect(() => getBlockTimestamp()).toThrow("Chain time is not known yet");
});

it("projects production at the newest chain-written timestamp while the clock runs on the estimate", () => {
  bindChainTime();
  useChainTimeStore.getState().setHeartbeat({ timestamp: HEAD_SECONDS * 1000, source: "herald-head" });

  const { currentBlockTimestamp, currentDefaultTick } = getBlockTimestamp();
  expect(currentDefaultTick).toBe(HEAD_SECONDS);
  expect(currentBlockTimestamp).toBeGreaterThanOrEqual(HEAD_SECONDS);
});

it("projects production at the confirmed floor, not at a pre-confirmed head, so MAX never outruns execution", () => {
  bindChainTime();
  const observer = createGameSyncObserver({ reportProgress: () => undefined, onSetupCompleted: () => undefined });
  // Game 8's Knight T1 barracks: 9.1667 a second, last settled at the barracks' creation.
  const settledAt = HEAD_SECONDS;
  const knightsPerSecond = 9_166_666_608 / 1_000_000_000;
  const knightsAt = (seconds: number) => Math.floor(knightsPerSecond * (seconds - settledAt));
  const confirmedAt = settledAt + 52;

  observer.onHead?.({ block: 32_944, preconfirmed: false, timestamp: confirmedAt });
  observer.onHead?.({ block: 32_945, preconfirmed: true, timestamp: confirmedAt + 2 });

  const { currentBlockTimestamp, currentDefaultTick } = getBlockTimestamp();
  expect(currentBlockTimestamp).toBeGreaterThanOrEqual(confirmedAt + 2);
  expect(currentDefaultTick).toBe(confirmedAt);
  // The gateway records the action at its latest confirmed head, so the chain holds at least this much when it runs.
  expect(knightsAt(currentDefaultTick)).toBeLessThanOrEqual(knightsAt(confirmedAt));
  expect(knightsAt(confirmedAt + 2)).toBeGreaterThan(knightsAt(confirmedAt));
});

it("keeps chain time where Herald's head put it while a realm's production waits for the main phase", async () => {
  // Game 6: the roster settled at 06:42, the main phase opened at 06:47:08. A balance read at entry treated the
  // producer as settled at the start, and the clock jumped four minutes ahead of the chain.
  bindChainTime();
  const startsAt = HEAD_SECONDS + 240;
  useChainTimeStore.getState().anchor({ timestamp: HEAD_SECONDS * 1000, source: "herald-head" });
  const store = new NativeFactStore();
  store.setSnapshot({ gameId: 1, complete: true, actor: null, timestamp: HEAD_SECONDS });
  const fact = (key: string, model: string, value: Record<string, unknown>) => ({ key, model, value });
  store.applyFacts([
    fact("0x1", "ResourceWeight", { game_id: 1, entity_id: 7, capacity: (1n << 128n) - 1n, weight: 0n }),
    fact("0x1", "ResourceProduction", {
      game_id: 1,
      entity_id: 7,
      resource_type: 23,
      building_count: 1,
      production_rate: 2n,
      output_amount_left: 10n,
      last_settled_at: HEAD_SECONDS - 60,
    }),
    fact("0x2", "SliceRules", { ...preset.rules, game_id: 1, mode_rules: nativeRuleConstants.PRODUCTION_START }),
    fact("0x2", "GameRegistry", {
      game_id: 1,
      name: 1n,
      preset_id: 1,
      settled: false,
      ready: true,
      dev_mode_on: false,
      start_settling_at: BigInt(HEAD_SECONDS - 60),
      start_main_at: BigInt(startsAt),
      end_at: BigInt(startsAt + 3600),
      end_grace_seconds: 0,
      seed: 1n,
    }),
  ]);

  expect(new ResourceManager(store, 7, 1).balanceWithProduction(HEAD_SECONDS, 23)?.balance).toBe(0);
  await new Promise((settled) => setTimeout(settled, 0));

  expect(Math.floor((useChainTimeStore.getState().nowMs ?? 0) / 1000)).toBe(HEAD_SECONDS);
  expect(getBlockTimestamp().currentBlockTimestamp).toBeLessThan(startsAt);
});
