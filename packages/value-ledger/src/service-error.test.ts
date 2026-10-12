import { describe, expect, it } from "vitest";
import { serviceError } from "./service-error";

describe("declared service errors", () => {
  it("keeps a fixed code inside a wrapped error", () => {
    const error = new Error('RelayFailure: {"operation":"relay_target_differs"}');
    expect(serviceError(error, ["relay_target_differs"], "unavailable")).toBe("relay_target_differs");
  });
  it("keeps an approval code followed by status text, including a wrapped cause", () => {
    const cause = new Error("relay_device_approval_refused: HTTP 401; code unauthorized");
    expect(serviceError(cause, ["relay_device_approval_refused"], "unavailable")).toBe("relay_device_approval_refused");
    expect(
      serviceError(
        new Error("account_join_approval_failed", { cause }),
        ["relay_device_approval_refused"],
        "unavailable",
      ),
    ).toBe("relay_device_approval_refused");
  });
  it("never returns arbitrary error text", () => {
    expect(serviceError(new Error("private credential"), ["relay_target_differs"], "unavailable")).toBe("unavailable");
  });
});
