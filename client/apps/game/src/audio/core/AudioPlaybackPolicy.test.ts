// @vitest-environment node

import { describe, expect, it } from "vitest";

import { AudioCategory } from "../types";
import { AudioPlaybackPolicy } from "./AudioPlaybackPolicy";

const createRequest = (overrides: Partial<Parameters<AudioPlaybackPolicy["registerStart"]>[0]> = {}) => ({
  assetId: "ui.click",
  category: AudioCategory.UI,
  priority: 6,
  nowMs: 0,
  ...overrides,
});

describe("AudioPlaybackPolicy", () => {
  it("caps how many UI sounds can stay active at once", () => {
    const policy = new AudioPlaybackPolicy();

    expect(policy.registerStart(createRequest({ assetId: "ui.click", nowMs: 0, priority: 10 })).allowed).toBe(true);
    expect(policy.registerStart(createRequest({ assetId: "ui.hover", nowMs: 10, priority: 8 })).allowed).toBe(true);
    expect(policy.registerStart(createRequest({ assetId: "ui.modal_open", nowMs: 20, priority: 7 })).allowed).toBe(
      true,
    );

    expect(policy.registerStart(createRequest({ assetId: "ui.toast_info", nowMs: 30, priority: 4 }))).toMatchObject({
      allowed: false,
      reason: "category_cap",
    });
  });

  it("applies longer cooldowns to noisy notification sounds", () => {
    const policy = new AudioPlaybackPolicy();

    expect(policy.registerStart(createRequest({ assetId: "ui.msg_receive", nowMs: 0, priority: 6 })).allowed).toBe(
      true,
    );
    policy.registerEnd({ assetId: "ui.msg_receive", category: AudioCategory.UI });

    expect(policy.registerStart(createRequest({ assetId: "ui.msg_receive", nowMs: 100, priority: 6 }))).toMatchObject({
      allowed: false,
      reason: "cooldown",
    });

    expect(policy.registerStart(createRequest({ assetId: "ui.msg_receive", nowMs: 600, priority: 6 })).allowed).toBe(
      true,
    );
  });

  it("drops low-priority sounds when a burst is already dense, but still lets protected cues through", () => {
    const policy = new AudioPlaybackPolicy();

    expect(policy.registerStart(createRequest({ assetId: "ui.click", nowMs: 0, priority: 8 })).allowed).toBe(true);
    expect(policy.registerStart(createRequest({ assetId: "ui.hover", nowMs: 50, priority: 7 })).allowed).toBe(true);
    expect(
      policy.registerStart(
        createRequest({ assetId: "resource.collect.wood", nowMs: 100, category: AudioCategory.RESOURCE, priority: 8 }),
      ).allowed,
    ).toBe(true);
    expect(
      policy.registerStart(
        createRequest({
          assetId: "building.construct.mine",
          nowMs: 150,
          category: AudioCategory.BUILDING,
          priority: 7,
        }),
      ).allowed,
    ).toBe(true);

    expect(policy.registerStart(createRequest({ assetId: "ui.toast_info", nowMs: 200, priority: 4 }))).toMatchObject({
      allowed: false,
      reason: "burst_limit",
    });

    expect(
      policy.registerStart({
        assetId: "combat.under_attack",
        category: AudioCategory.COMBAT,
        priority: 8,
        nowMs: 210,
      }).allowed,
    ).toBe(true);
  });
});
