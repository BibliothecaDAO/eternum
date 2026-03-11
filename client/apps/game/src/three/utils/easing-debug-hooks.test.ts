import { describe, expect, it } from "vitest";

import { installEasingDebugHooks } from "./easing";

describe("installEasingDebugHooks", () => {
  it("installs easing debug hooks in DEV mode", () => {
    const target: Record<string, unknown> = {};

    installEasingDebugHooks({ target, isDev: true });

    expect(target.testEasing).toBeTypeOf("function");
    expect(target.listEasingTypes).toBeTypeOf("function");
  });

  it("skips easing debug hooks outside DEV mode", () => {
    const target: Record<string, unknown> = {};

    installEasingDebugHooks({ target, isDev: false });

    expect(target.testEasing).toBeUndefined();
    expect(target.listEasingTypes).toBeUndefined();
  });
});
