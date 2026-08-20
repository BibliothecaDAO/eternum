import { describe, expect, it, vi } from "vitest";
import { reportArmyIntegrityHealOnce } from "./army-integrity-diagnostics";

describe("army integrity diagnostics", () => {
  it("reports each production integrity-heal signature once as a single string", () => {
    const reportedSignatures = new Set<string>();
    const warn = vi.fn();
    const input = {
      rendererMode: "webgpu" as const,
      reportedSignatures,
      violation: { kind: "visible-not-drawn" as const, entityId: 42 },
      warn,
    };

    expect(reportArmyIntegrityHealOnce(input)).toBe(true);
    expect(reportArmyIntegrityHealOnce(input)).toBe(false);

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "[ArmyManager] render-integrity-heal renderer_mode=webgpu heal_signature=missing:42 violation_kind=visible-not-drawn",
    );
    expect(typeof warn.mock.calls[0][0]).toBe("string");
  });
});
