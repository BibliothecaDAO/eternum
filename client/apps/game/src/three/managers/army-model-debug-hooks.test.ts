import { describe, expect, it } from "vitest";

import { installArmyModelDebugHooks } from "./army-model-debug-hooks";

describe("installArmyModelDebugHooks", () => {
  it("installs army-model debug hooks in DEV mode", () => {
    const target: Record<string, unknown> = {};

    installArmyModelDebugHooks({ target, isDev: true });

    expect(target.setArmyEasing).toBeTypeOf("function");
    expect(target.setTierEasing).toBeTypeOf("function");
  });

  it("skips army-model debug hooks outside DEV mode", () => {
    const target: Record<string, unknown> = {};

    installArmyModelDebugHooks({ target, isDev: false });

    expect(target.setArmyEasing).toBeUndefined();
    expect(target.setTierEasing).toBeUndefined();
  });
});
