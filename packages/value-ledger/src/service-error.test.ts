import { describe, expect, it } from "vitest";
import { serviceError } from "./service-error";

describe("declared service errors", () => {
  it("keeps a fixed code inside a wrapped error", () => {
    const error = new Error('RelayFailure: {"operation":"relay_target_differs"}');
    expect(serviceError(error, ["relay_target_differs"], "unavailable")).toBe("relay_target_differs");
  });
  it("never returns arbitrary error text", () => {
    expect(serviceError(new Error("private credential"), ["relay_target_differs"], "unavailable")).toBe("unavailable");
  });
});
