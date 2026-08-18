// @vitest-environment node

import { TickIds } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configManager } from "./config-manager";

type ConfigManagerInternals = {
  components: unknown;
  config: unknown;
  configSynced: boolean;
  warnedConfigMissSites: Set<string>;
};

const internals = configManager as unknown as ConfigManagerInternals;

const enterSyncedState = () => {
  internals.components = {};
  internals.config = {};
  configManager.markConfigSynced();
};

afterEach(() => {
  vi.restoreAllMocks();
  internals.components = undefined;
  internals.config = undefined;
  internals.configSynced = false;
  internals.warnedConfigMissSites.clear();
});

describe("ClientConfigManager loud miss + recovery", () => {
  it("warns once on a post-sync miss, once on recovery, then stays silent", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    enterSyncedState();
    const rulebook = vi.spyOn(configManager, "getRulebook");

    // Missing rulebook: repeated lookups warn exactly once.
    rulebook.mockReturnValue(undefined as never);
    expect(configManager.getTick(TickIds.Armies)).toBe(0);
    expect(configManager.getTick(TickIds.Armies)).toBe(0);
    const missWarnings = warn.mock.calls.filter(([message]) => String(message).includes("using default"));
    expect(missWarnings).toHaveLength(1);

    // Rulebook hydrates: one recovery line, then repeated hits stay silent.
    rulebook.mockReturnValue({ tick_config: { armies_tick_in_seconds: 60 } } as never);
    expect(configManager.getTick(TickIds.Armies)).toBe(60);
    expect(configManager.getTick(TickIds.Armies)).toBe(60);
    const recoveryWarnings = warn.mock.calls.filter(([message]) => String(message).includes("config miss resolved"));
    expect(recoveryWarnings).toHaveLength(1);
  });

  it("pays no recovery bookkeeping when no miss is outstanding", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    enterSyncedState();
    vi.spyOn(configManager, "getRulebook").mockReturnValue({
      tick_config: { armies_tick_in_seconds: 60 },
    } as never);

    expect(configManager.getTick(TickIds.Armies)).toBe(60);
    expect(warn).not.toHaveBeenCalled();
  });
});
