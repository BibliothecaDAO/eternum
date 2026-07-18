import { describe, expect, test } from "bun:test";
import {
  buildFactoryRuntimeAlias,
  buildGameRuntimeAlias,
  assertCompleteActiveGameStack,
  clearInstalledRuntimeRegistry,
  getDefaultRuntimeRegistry,
  loadRuntimeRegistry,
  parseRuntimeRegistry,
  resolveRuntimeEndpointAlias,
} from "../../../../common/factory/runtime-registry";
import {
  removeRuntimeArtifact,
  removeActiveGameStackPublication,
  removeRuntimeArtifacts,
  registerReadyGameStack,
  registerRuntimeArtifact,
  registerRuntimeEndpointRegistrations,
  switchRuntimeAliasProvider,
} from "../../../../common/factory/runtime-registry-artifact";
import { buildLaunchRuntimeRegistrations } from "../../../../common/factory/runtime-registry-launch";
import { applyRuntimeTeardownResult } from "../../../../scripts/update-runtime-registry";

describe("runtime endpoint registry", () => {
  test("keeps production Blitz runtimes out of the historical Slot defaults", () => {
    const productionRuntimeAliases = Object.values(getDefaultRuntimeRegistry().aliases).filter(
      (entry) => entry.environmentId === "mainnet.blitz" && entry.runtimeKind !== "chain-rpc",
    );

    expect(productionRuntimeAliases).toEqual([]);
  });

  test("publishes a complete production game stack in one AWS-only revision", () => {
    const registry = registerReadyGameStack(
      getDefaultRuntimeRegistry(),
      {
        environmentId: "mainnet.blitz",
        gameStackId: "blitz-season-42",
        activeUntil: "2026-07-18T14:30:00.000Z",
        attestationMeasurement: `sha384:${"c".repeat(96)}`,
        verification: {
          identitySealedAt: "2026-07-18T12:20:00.000Z",
          attestationVerifiedAt: "2026-07-18T12:25:00.000Z",
          worldReadyAt: "2026-07-18T12:30:00.000Z",
          indexerReadyAt: "2026-07-18T12:35:00.000Z",
          registryVerifiedAt: "2026-07-18T12:40:00.000Z",
        },
        katana: {
          runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
          imageDigest: `sha256:${"a".repeat(64)}`,
          routingShard: 0,
          endpoints: {
            base: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/katana",
            health: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/katana/health",
            rpc: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/katana/rpc/v0_9",
          },
        },
        torii: {
          runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b452",
          imageDigest: `sha256:${"b".repeat(64)}`,
          routingShard: 0,
          endpoints: {
            base: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/torii",
            health: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/torii/health",
            sql: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/torii/sql",
          },
        },
      },
      new Date("2026-07-18T12:41:00.000Z"),
    );

    const staleRemoval = removeActiveGameStackPublication(registry, {
      gameStackId: "blitz-season-42",
      activeUntil: "2026-07-18T14:30:00.000Z",
      publicationRevision: registry.revision - 1,
    });
    const removed = removeActiveGameStackPublication(registry, {
      gameStackId: "blitz-season-42",
      activeUntil: "2026-07-18T14:30:00.000Z",
      publicationRevision: registry.revision,
    });

    expect(registry.revision).toBe(getDefaultRuntimeRegistry().revision + 1);
    for (const runtimeKind of ["katana", "torii"] as const) {
      const endpointKind = runtimeKind === "katana" ? "rpc" : "sql";
      const alias = buildGameRuntimeAlias("mainnet.blitz", "blitz-season-42", runtimeKind, endpointKind);
      expect(registry.aliases[alias]).toMatchObject({
        activeProvider: "aws",
        activeUntil: "2026-07-18T14:30:00.000Z",
        publicationRevision: registry.revision,
        providers: { aws: expect.any(String) },
      });
      expect(registry.aliases[alias]?.providers.slot).toBeUndefined();
    }
    expect(() =>
      assertCompleteActiveGameStack(registry, "blitz-season-42", new Date("2026-07-18T13:00:00.000Z")),
    ).not.toThrow();
    expect(registry.activeGameStacks?.["mainnet.blitz"]).toEqual({
      gameStackId: "blitz-season-42",
      activeUntil: "2026-07-18T14:30:00.000Z",
      publicationRevision: registry.revision,
      attestationMeasurement: `sha384:${"c".repeat(96)}`,
      verification: {
        identitySealedAt: "2026-07-18T12:20:00.000Z",
        attestationVerifiedAt: "2026-07-18T12:25:00.000Z",
        worldReadyAt: "2026-07-18T12:30:00.000Z",
        indexerReadyAt: "2026-07-18T12:35:00.000Z",
        registryVerifiedAt: "2026-07-18T12:40:00.000Z",
      },
    });
    expect(() =>
      assertCompleteActiveGameStack(registry, "blitz-season-42", new Date("2026-07-18T14:30:00.000Z")),
    ).toThrow("is expired");
    expect(staleRemoval).toEqual(registry);

    expect(removed.activeGameStacks?.["mainnet.blitz"]).toBeUndefined();
    expect(removed.aliases[buildGameRuntimeAlias("mainnet.blitz", "blitz-season-42", "katana", "rpc")]).toBeDefined();
    expect(() =>
      assertCompleteActiveGameStack(removed, "blitz-season-42", new Date("2026-07-18T13:00:00.000Z")),
    ).toThrow("is not the registry's active stack");
  });

  test("rejects future-dated readiness even when the remote registry future-dates itself", () => {
    const registry = getDefaultRuntimeRegistry();
    const gameStackId = "blitz-season-future";
    const futureRegistry = {
      ...registry,
      revision: registry.revision + 1,
      generatedAt: "2099-07-18T12:41:00.000Z",
      activeGameStacks: {
        "mainnet.blitz": {
          gameStackId,
          activeUntil: "2099-07-18T14:30:00.000Z",
          publicationRevision: registry.revision + 1,
          attestationMeasurement: `sha384:${"c".repeat(96)}`,
          verification: {
            identitySealedAt: "2099-07-18T12:20:00.000Z",
            attestationVerifiedAt: "2099-07-18T12:25:00.000Z",
            worldReadyAt: "2099-07-18T12:30:00.000Z",
            indexerReadyAt: "2099-07-18T12:35:00.000Z",
            registryVerifiedAt: "2099-07-18T12:40:00.000Z",
          },
        },
      },
    };

    expect(() =>
      assertCompleteActiveGameStack(futureRegistry, gameStackId, new Date("2026-07-18T12:41:00.000Z")),
    ).toThrow("future-dated readiness evidence");
  });

  test("rejects partial production game-stack publication through the generic runtime path", () => {
    expect(() =>
      registerRuntimeArtifact(
        getDefaultRuntimeRegistry(),
        {
          schemaVersion: 2,
          environmentId: "mainnet.blitz",
          runtimeKind: "torii",
          runtimeName: "blitz-season-42",
          runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b452",
          imageDigest: `sha256:${"b".repeat(64)}`,
          routingShard: 0,
          endpoints: {
            base: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/torii",
            health: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/torii/health",
            sql: "https://s0.mainnet-blitz.runtime.realms.world/x/blitz-season-42/torii/sql",
          },
        },
        { scope: "game", provider: "aws", activate: true },
      ),
    ).toThrow("Production Blitz runtimes must be published as one complete ready game stack");
  });

  test("resolves the registry Slot target by default", () => {
    expect(resolveRuntimeEndpointAlias(buildFactoryRuntimeAlias("slot"))).toBe(
      "https://api.cartridge.gg/x/eternum-factory-slot-d/torii/sql",
    );
  });

  test("refuses to synthesize an AWS host when the alias is not registered", () => {
    expect(() =>
      resolveRuntimeEndpointAlias(buildFactoryRuntimeAlias("slot"), {
        provider: "aws",
      }),
    ).toThrow("has no aws rollback target");
  });

  test("registers complete AWS artifact endpoints while retaining Slot rollback aliases", () => {
    const runtimeName = "blitz-game-42";
    const baseAlias = buildGameRuntimeAlias("slot.blitz", runtimeName, "torii", "base");
    const registry = {
      ...getDefaultRuntimeRegistry(),
      aliases: {
        ...getDefaultRuntimeRegistry().aliases,
        [baseAlias]: {
          scope: "game" as const,
          environmentId: "slot.blitz",
          runtimeKind: "torii" as const,
          endpointKind: "base" as const,
          activeProvider: "slot" as const,
          providers: {
            slot: "https://api.cartridge.gg/x/blitz-game-42/torii",
          },
        },
      },
    };

    const registered = registerRuntimeArtifact(
      registry,
      {
        schemaVersion: 2,
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName,
        runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
        imageDigest: `sha256:${"a".repeat(64)}`,
        routingShard: 0,
        endpoints: {
          base: "https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/blitz-game-42/torii",
          health: "https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/blitz-game-42/torii/health",
          sql: "https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/blitz-game-42/torii/sql",
        },
      },
      {
        scope: "game",
        provider: "aws",
        fallbackEndpoints: {
          health: "https://api.cartridge.gg/x/blitz-game-42/torii/health",
          sql: "https://api.cartridge.gg/x/blitz-game-42/torii/sql",
        },
      },
    );

    expect(registered.aliases[baseAlias]?.activeProvider).toBe("slot");
    expect(registered.aliases[baseAlias]?.runtimeName).toBe(runtimeName);
    expect(registered.aliases[baseAlias]?.providers.aws).toContain("s0.slot-blitz.runtime.realms.world");
    expect(registered.aliases[baseAlias]?.providers.slot).toContain("api.cartridge.gg");

    const activated = switchRuntimeAliasProvider(registered, `game.slot.blitz.${runtimeName}.torii.`, "aws");
    expect(resolveRuntimeEndpointAlias(baseAlias, { registry: activated })).toContain(
      "s0.slot-blitz.runtime.realms.world",
    );

    const rolledBack = switchRuntimeAliasProvider(activated, `game.slot.blitz.${runtimeName}.torii.`, "slot");
    expect(resolveRuntimeEndpointAlias(baseAlias, { registry: rolledBack })).toContain("api.cartridge.gg");
  });

  test("registers multiple launched Slot runtimes in one public registry revision", () => {
    const registry = registerRuntimeEndpointRegistrations(
      getDefaultRuntimeRegistry(),
      ["game-41", "game-42"].map((runtimeName) => ({
        scope: "game" as const,
        provider: "slot" as const,
        activate: true,
        environmentId: "slot.blitz",
        runtimeKind: "torii" as const,
        runtimeName,
        endpoints: {
          base: `https://api.cartridge.gg/x/${runtimeName}/torii`,
          health: `https://api.cartridge.gg/x/${runtimeName}/torii/health`,
          sql: `https://api.cartridge.gg/x/${runtimeName}/torii/sql`,
        },
      })),
    );

    expect(registry.revision).toBe(getDefaultRuntimeRegistry().revision + 1);
    for (const runtimeName of ["game-41", "game-42"]) {
      const alias = buildGameRuntimeAlias("slot.blitz", runtimeName, "torii", "base");
      expect(registry.aliases[alias]?.activeProvider).toBe("slot");
      expect(registry.aliases[alias]?.providers.slot).toContain(runtimeName);
    }
  });

  test("turns Slot and grouped AWS launch summaries into one rollback-safe registry update", () => {
    const runtimeName = "game-42";
    const awsBase = `https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/${runtimeName}/torii`;
    const registrations = buildLaunchRuntimeRegistrations(
      [
        {
          environment: "slot.blitz",
          gameName: runtimeName,
          runtimeProvider: "slot",
          indexerUrl: `https://api.cartridge.gg/x/${runtimeName}/torii/`,
        },
        {
          environment: "slot.blitz",
          games: [
            {
              gameName: runtimeName,
              artifacts: {
                runtimeProvider: "aws",
                awsRuntime: {
                  runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
                  imageDigest: `sha256:${"a".repeat(64)}`,
                  routingShard: 0,
                  endpoints: {
                    base: awsBase,
                    health: `${awsBase}/health`,
                    sql: `${awsBase}/sql`,
                  },
                },
              },
            },
          ],
        },
      ],
      { activateAws: true },
    );

    const registry = registerRuntimeEndpointRegistrations(getDefaultRuntimeRegistry(), registrations);
    const alias = buildGameRuntimeAlias("slot.blitz", runtimeName, "torii", "base");
    expect(registrations).toHaveLength(2);
    expect(registry.revision).toBe(getDefaultRuntimeRegistry().revision + 1);
    expect(registry.aliases[alias]).toMatchObject({
      activeProvider: "aws",
      providers: {
        slot: `https://api.cartridge.gg/x/${runtimeName}/torii`,
        aws: awsBase,
      },
    });
  });

  test("rejects noncanonical aliases and missing active endpoints", () => {
    expect(() =>
      parseRuntimeRegistry({
        schemaVersion: "realms-runtime-registry/v1",
        revision: 1,
        generatedAt: "2026-07-10T00:00:00.000Z",
        aliases: {
          "Bad Alias": {
            scope: "game",
            environmentId: "slot.blitz",
            runtimeKind: "torii",
            endpointKind: "base",
            activeProvider: "aws",
            providers: { slot: "https://api.cartridge.gg/x/game/torii" },
          },
        },
      }),
    ).toThrow("not canonical");
  });

  test("removes a runtime instance and restores every alias to Slot", () => {
    const runtimeInstanceId = "9c71925b-e87d-4a26-85cf-e5476274b451";
    const artifact = {
      schemaVersion: 2 as const,
      environmentId: "slot.blitz",
      runtimeKind: "torii" as const,
      runtimeName: "blitz-game-42",
      runtimeInstanceId,
      imageDigest: `sha256:${"a".repeat(64)}`,
      routingShard: 0,
      endpoints: {
        base: "https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/blitz-game-42/torii",
        health: "https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/blitz-game-42/torii/health",
        sql: "https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/blitz-game-42/torii/sql",
      },
    };
    const fallbackEndpoints = {
      base: "https://api.cartridge.gg/x/blitz-game-42/torii",
      health: "https://api.cartridge.gg/x/blitz-game-42/torii/health",
      sql: "https://api.cartridge.gg/x/blitz-game-42/torii/sql",
    };
    const registered = registerRuntimeArtifact(getDefaultRuntimeRegistry(), artifact, {
      scope: "game",
      provider: "aws",
      activate: true,
      fallbackEndpoints,
    });

    const removed = removeRuntimeArtifact(registered, artifact.runtimeInstanceId);
    const aliases = Object.values(removed.aliases).filter(
      (entry) => entry.environmentId === artifact.environmentId && entry.runtimeKind === artifact.runtimeKind,
    );
    expect(aliases.length).toBeGreaterThan(0);
    expect(aliases.every((entry) => entry.activeProvider === "slot" && !entry.providers.aws)).toBe(true);
    expect(aliases.every((entry) => !entry.runtimeInstanceId)).toBe(true);
    expect(aliases.every((entry) => !entry.runtimeName)).toBe(true);
    expect(removeRuntimeArtifact(removed, artifact.runtimeInstanceId)).toBe(removed);
  });

  test("removes a maintenance batch in one registry revision", () => {
    const artifacts = ["game-51", "game-52"].map((runtimeName, index) => ({
      schemaVersion: 2 as const,
      environmentId: "slot.blitz",
      runtimeKind: "torii" as const,
      runtimeName,
      runtimeInstanceId: `9c71925b-e87d-4a26-85cf-e5476274b45${index}`,
      imageDigest: `sha256:${"a".repeat(64)}`,
      routingShard: 0,
      endpoints: {
        base: `https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/${runtimeName}/torii`,
        health: `https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/${runtimeName}/torii/health`,
        sql: `https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/${runtimeName}/torii/sql`,
      },
    }));
    const registered = artifacts.reduce(
      (registry, artifact) =>
        registerRuntimeArtifact(registry, artifact, {
          scope: "game",
          provider: "aws",
          activate: true,
          fallbackEndpoints: {
            base: `https://api.cartridge.gg/x/${artifact.runtimeName}/torii`,
            health: `https://api.cartridge.gg/x/${artifact.runtimeName}/torii/health`,
            sql: `https://api.cartridge.gg/x/${artifact.runtimeName}/torii/sql`,
          },
        }),
      getDefaultRuntimeRegistry(),
    );

    const removed = removeRuntimeArtifacts(
      registered,
      artifacts.map((artifact) => artifact.runtimeInstanceId),
    );
    expect(removed.revision).toBe(registered.revision + 1);
    for (const artifact of artifacts) {
      const alias = buildGameRuntimeAlias("slot.blitz", artifact.runtimeName, "torii", "base");
      expect(removed.aliases[alias]?.activeProvider).toBe("slot");
      expect(removed.aliases[alias]?.providers.aws).toBeUndefined();
    }
  });

  test("keeps AWS aliases active for stale single-runtime teardown results", () => {
    const alias = buildFactoryRuntimeAlias("slot");
    const runtimeInstanceId = "9c71925b-e87d-4a26-85cf-e5476274b451";
    const current = parseRuntimeRegistry({
      ...getDefaultRuntimeRegistry(),
      revision: 4,
      aliases: {
        ...getDefaultRuntimeRegistry().aliases,
        [alias]: {
          ...getDefaultRuntimeRegistry().aliases[alias],
          activeProvider: "aws",
          runtimeName: "eternum-factory-slot-d",
          runtimeInstanceId,
          imageDigest: `sha256:${"a".repeat(64)}`,
          routingShard: 0,
          providers: {
            ...getDefaultRuntimeRegistry().aliases[alias]?.providers,
            aws: "https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/eternum-factory-slot-d/torii/sql",
          },
        },
      },
    });

    const skipped = applyRuntimeTeardownResult(current, {
      operation: "delete",
      action: "skipped-stale",
      runtimeInstanceId,
    });
    const deleted = applyRuntimeTeardownResult(current, {
      operation: "delete",
      action: "deleted",
      runtimeInstanceId,
    });

    expect(skipped).toBe(current);
    expect(skipped.aliases[alias]?.activeProvider).toBe("aws");
    expect(deleted.aliases[alias]?.activeProvider).toBe("slot");
    expect(deleted.aliases[alias]?.providers.aws).toBeUndefined();
  });

  test("loads an uncached public registry and installs its active provider", async () => {
    const alias = buildFactoryRuntimeAlias("slot");
    const registry = {
      ...getDefaultRuntimeRegistry(),
      revision: 2,
      aliases: {
        ...getDefaultRuntimeRegistry().aliases,
        [alias]: {
          ...getDefaultRuntimeRegistry().aliases[alias],
          activeProvider: "aws" as const,
          runtimeName: "eternum-factory-slot-d",
          runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
          imageDigest: `sha256:${"a".repeat(64)}`,
          routingShard: 0,
          providers: {
            slot: "https://api.cartridge.gg/x/eternum-factory-slot-d/torii/sql",
            aws: "https://s0.slot-blitz.runtime.realms.world/x/slot-blitz/factory/torii/sql",
          },
        },
      },
    };
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.cache).toBe("no-store");
      return Response.json(registry);
    }) as typeof fetch;

    try {
      const loaded = await loadRuntimeRegistry({
        fetchImpl,
        url: "https://registry.realms.world/runtime.json",
      });

      expect(loaded.source).toBe("remote");
      expect(loaded.registry.revision).toBe(2);
      expect(resolveRuntimeEndpointAlias(alias)).toContain("s0.slot-blitz.runtime.realms.world");
    } finally {
      clearInstalledRuntimeRegistry();
    }
  });

  test("retains the embedded registry when the public registry is unavailable", async () => {
    const embedded = JSON.stringify(getDefaultRuntimeRegistry());
    const fetchImpl = (async () => {
      throw new Error("connection refused");
    }) as typeof fetch;

    try {
      const loaded = await loadRuntimeRegistry({
        embedded,
        fetchImpl,
        url: "https://registry.realms.world/runtime.json",
      });

      expect(loaded.source).toBe("embedded");
      expect(loaded.remoteError).toBe("connection refused");
      expect(resolveRuntimeEndpointAlias(buildFactoryRuntimeAlias("slot"))).toContain("api.cartridge.gg");
    } finally {
      clearInstalledRuntimeRegistry();
    }
  });

  test("fails closed when a required production registry is unavailable", async () => {
    await expect(
      loadRuntimeRegistry({
        required: true,
        fetchImpl: (async () => {
          throw new Error("connection refused");
        }) as typeof fetch,
        url: "https://registry.realms.world/runtime.json",
      }),
    ).rejects.toThrow("Required runtime registry is unavailable: connection refused");

    await expect(loadRuntimeRegistry({ required: true })).rejects.toThrow("Required runtime registry URL is missing");
  });
});
