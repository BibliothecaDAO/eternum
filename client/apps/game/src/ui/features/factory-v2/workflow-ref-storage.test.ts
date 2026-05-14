import { describe, expect, it } from "vitest";

import { FACTORY_V2_WORKFLOW_REF_STORAGE_KEY, resolveFactoryV2WorkflowRef } from "./workflow-ref-storage";

function buildStorage(value: string | null) {
  return {
    getItem: (key: string) => (key === FACTORY_V2_WORKFLOW_REF_STORAGE_KEY ? value : null),
  };
}

describe("resolveFactoryV2WorkflowRef", () => {
  it("returns undefined outside dev mode", () => {
    expect(
      resolveFactoryV2WorkflowRef({
        isDev: false,
        storage: buildStorage("credence0x/blitz-hex-map"),
        envWorkflowRef: "env-branch",
      }),
    ).toBeUndefined();
  });

  it("returns the local storage override in dev mode", () => {
    expect(
      resolveFactoryV2WorkflowRef({
        isDev: true,
        storage: buildStorage("credence0x/blitz-hex-map"),
      }),
    ).toBe("credence0x/blitz-hex-map");
  });

  it("falls back to the env override when local storage is empty", () => {
    expect(
      resolveFactoryV2WorkflowRef({
        isDev: true,
        storage: buildStorage(""),
        envWorkflowRef: "env-branch",
      }),
    ).toBe("env-branch");
  });

  it("ignores blank override values", () => {
    expect(
      resolveFactoryV2WorkflowRef({
        isDev: true,
        storage: buildStorage("   "),
        envWorkflowRef: "   ",
      }),
    ).toBeUndefined();
  });
});
