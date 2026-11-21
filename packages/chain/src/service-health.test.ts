import { expect, test } from "vitest";
import { dependencyDown, dependencyUp, readThroughDependency, serviceDependencies } from "./service-health";

test("a read that fails names its dependency, when and the code; one that answers hands its value on", async () => {
  expect(
    await readThroughDependency(
      "store",
      1_000,
      async () => 7,
      () => "unused",
    ),
  ).toEqual({ dependency: { name: "store", ok: true, since: null, code: null }, value: 7 });
  expect(
    await readThroughDependency(
      "ledger-rpc",
      1_000,
      async () => {
        throw new Error("HTTP 429 from https://rpc.test/v2/key");
      },
      () => "rpc_unavailable",
    ),
  ).toEqual({ dependency: { name: "ledger-rpc", ok: false, since: 1_000, code: "rpc_unavailable" }, value: null });
});

test("a health body's dependencies are read whole or refused", () => {
  const dependencies = [dependencyUp("store"), dependencyDown("ledger-rpc", 1_000, "rpc_unavailable")];
  expect(serviceDependencies({ dependencies })).toEqual(dependencies);
  for (const malformed of [
    undefined,
    [],
    [{ name: "store", ok: true }],
    [{ name: "store", ok: false, since: null, code: null }],
    [{ name: "store", ok: true, since: 1_000, code: "late" }],
    [{ name: "store", ok: false, since: 1_000, code: "HTTP 429 from https://rpc.test/v2/key" }],
    [{ name: "store", ok: true, since: null, code: null, url: "https://rpc.test/v2/key" }],
  ])
    expect(() => serviceDependencies({ dependencies: malformed })).toThrow("service_dependencies_malformed");
});
