import { expect, test } from "vitest";

import {
  dependencyDown,
  dependencyUp,
  readThroughDependency,
  serviceDependencies,
} from "./service-health";

test("a read that fails names its dependency and the code; one that answers hands its value on", async () => {
  expect(
    await readThroughDependency(
      "store",
      async () => 7,
      () => "unused",
    ),
  ).toEqual({ dependency: { name: "store", ok: true, code: null }, value: 7 });
  expect(
    await readThroughDependency(
      "ledger-rpc",
      async () => {
        throw new Error("HTTP 429 from https://rpc.test/v2/key");
      },
      () => "rpc_unavailable",
    ),
  ).toEqual({
    dependency: { name: "ledger-rpc", ok: false, code: "rpc_unavailable" },
    value: null,
  });
});

test("a health body's dependencies are read whole or refused", () => {
  const dependencies = [
    dependencyUp("store"),
    dependencyDown("ledger-rpc", "rpc_unavailable"),
  ];
  expect(serviceDependencies({ dependencies })).toEqual(dependencies);
  for (const malformed of [
    undefined,
    [],
    [{ name: "store", ok: true }],
    [{ name: "store", ok: false, code: null }],
    [{ name: "store", ok: true, code: "late" }],
    [
      {
        name: "store",
        ok: false,
        code: "HTTP 429 from https://rpc.test/v2/key",
      },
    ],
    [{ name: "store", ok: true, code: null, url: "https://rpc.test/v2/key" }],
  ])
    expect(() => serviceDependencies({ dependencies: malformed })).toThrow(
      "service_dependencies_malformed",
    );
});
