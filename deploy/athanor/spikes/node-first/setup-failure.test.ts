import { expect, test } from "bun:test";
import { publicSetupFailure } from "./setup-failure";

test("approval refusal status survives without copying bearer tokens or response bodies", () => {
  const secret = "dummy-sensitive-value";
  const error = new Error("Failed to deploy account", {
    cause: new Error(`Bot device approval refused: 429 Bearer ${secret}`),
  });
  const result = publicSetupFailure(error);
  expect(result.causes[1]!.approvalStatus).toBe(429);
  expect(result.causes[1]!.hints).toContain("approval");
  expect(JSON.stringify(result)).not.toContain(secret);
  expect(JSON.stringify(result)).not.toContain("Bearer");
});

test("RPC codes and nonce classification survive without signed request data", () => {
  const result = publicSetupFailure({
    name: "RpcError",
    code: 52,
    message: "Invalid nonce",
    data: "dummy-private-request",
  });
  expect(result.causes[0]!.code).toBe(52);
  expect(result.causes[0]!.hints).toEqual(["nonce"]);
  expect(JSON.stringify(result)).not.toContain("dummy-private-request");
});

test("cyclic or unknown errors cannot leak names or loop forever", () => {
  const error: { name: string; cause?: unknown } = { name: "dummy-sensitive-name" };
  error.cause = error;
  const result = publicSetupFailure(error);
  expect(result.causes).toHaveLength(1);
  expect(result.causes[0]!.kind).toBe("unknown");
  expect(JSON.stringify(result)).not.toContain(error.name);
  expect(publicSetupFailure(undefined).causes).toEqual([]);
});
