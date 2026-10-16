import { describe, expect, it } from "vitest";
import { ServiceResponseFailure, serviceResponseFailure, serviceError, serviceFailure } from "./service-error";

describe("declared service errors", () => {
  it("keeps a fixed code inside a wrapped error", () => {
    const error = Object.assign(new Error("failure"), { operation: "relay_target_differs" });
    expect(serviceError(error, ["relay_target_differs"], "unavailable")).toBe("relay_target_differs");
  });
  it("keeps an approval code followed by status text, including a wrapped cause", () => {
    const cause = new ServiceResponseFailure({
      stage: "relay_device_approval_refused",
      status: 401,
      code: "unauthorized",
      message: "refused",
    });
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

it("reports a nested undeclared failure without known or credential-shaped values", () => {
  const error = new Error("account_join_approval_failed", {
    cause: new TypeError(
      "Invalid redirect; Bearer another-token; private_key=short-secret; 0x" + "ab".repeat(32) + "; configured-secret",
    ),
  });
  expect(serviceFailure(error, [], "join_unavailable", ["configured-secret"])).toEqual({
    code: "join_unavailable",
    type: "TypeError",
    message: "Invalid redirect; [redacted]; [redacted]; [redacted]; [redacted]",
  });
});

it("does not extract declared codes from arbitrary or serialized diagnostic text", () => {
  for (const message of [
    'RelayFailure: {"operation":"relay_target_differs"}',
    "secret relay_target_differs extra",
    "prefix: relay_target_differs",
  ]) {
    expect(serviceError(new Error(message), ["relay_target_differs"], "unavailable")).toBe("unavailable");
  }
});

it("terminates on cyclic causes while keeping exact declared codes", () => {
  const error = new Error("relay_target_differs");
  error.cause = error;
  expect(serviceError(error, ["relay_target_differs"], "unavailable")).toBe("relay_target_differs");
  expect(serviceFailure(error, [], "unavailable", []).message).toBe("relay_target_differs");
});

it.each([{ error: "unauthorized" }, { error: "Bearer secret" }, null, {}])(
  "decodes a refused response without leaking response text",
  async (body) => {
    const error = await serviceResponseFailure("relay_device_approval_refused", Response.json(body, { status: 403 }));
    expect(error).toMatchObject({
      _tag: "ServiceResponseFailure",
      stage: "relay_device_approval_refused",
      status: 403,
      code: body?.error === "unauthorized" ? "unauthorized" : "invalid_service_error",
    });
    expect(serviceError(new Error("outer", { cause: error }), ["relay_device_approval_refused"], "fallback")).toBe(
      "relay_device_approval_refused",
    );
    expect(error.message).not.toContain("Bearer secret");
  },
);

it("keeps the HTTP status and stage when the failed response is not JSON", async () => {
  const failure = await serviceResponseFailure(
    "relay_device_approval_refused",
    new Response("proxy error", { status: 502 }),
  );
  expect(failure).toMatchObject({ status: 502, stage: "relay_device_approval_refused", code: "invalid_service_error" });
});

it("recognizes only a leading legacy code before diagnostic text", () => {
  const error = new Error("ledger_head_unconfirmed: Bearer secret-value");
  expect(serviceFailure(error, ["ledger_head_unconfirmed"], "fallback", [])).toEqual({
    code: "ledger_head_unconfirmed",
    type: "Error",
    message: "ledger_head_unconfirmed: [redacted]",
  });
});
