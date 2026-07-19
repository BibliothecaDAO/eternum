import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getProtocolPackageLane, validateProtocolPackageLane } from "./package-lane";

describe("A14 protocol package lane", () => {
  it("keeps settlement_protocol as an acyclic dependency leaf", () => {
    const lane = getProtocolPackageLane();
    const protocol = lane.packages.find(({ id }) => id === "settlement_protocol")!;

    expect(protocol.role).toBe("dependency-leaf");
    expect(protocol.cairoVersion).toBe("2.13.1");
    expect(protocol.starknetVersion).toBe("2.13.1");
    expect(protocol.dependencies).not.toContain("dojo");
    expect(protocol.dependencies.some((dependency) => dependency.startsWith("openzeppelin"))).toBe(false);
    expect(() => validateProtocolPackageLane(lane)).not.toThrow();
  });

  it("rejects a peer dependency cycle or an unpublished dependency pin", () => {
    const cyclicLane = getProtocolPackageLane();
    cyclicLane.packages.find(({ id }) => id === "mmr")!.internalDependencies.push("collectibles");
    cyclicLane.packages.find(({ id }) => id === "collectibles")!.internalDependencies.push("mmr");
    expect(() => validateProtocolPackageLane(cyclicLane)).toThrow("package dependency cycle includes");

    const incompleteLane = getProtocolPackageLane();
    delete incompleteLane.packages.find(({ id }) => id === "game")!.dependencyPins.dojo;
    expect(() => validateProtocolPackageLane(incompleteLane)).toThrow("does not publish every dependency pin");

    const unpinnedLane = getProtocolPackageLane();
    unpinnedLane.packages.find(({ id }) => id === "mmr")!.scarbVersion = null;
    expect(() => validateProtocolPackageLane(unpinnedLane)).toThrow("mmr is outside the frozen 2.13.1/0.51.2 lane");

    const unresolvedLane = getProtocolPackageLane();
    unresolvedLane.packages.find(({ id }) => id === "game")!.resolvedDependencies = [];
    expect(() => validateProtocolPackageLane(unresolvedLane)).toThrow(
      "dependency aliases disagree with Scarb metadata",
    );
  });

  it("rejects every internal dependency from the protocol leaf", () => {
    const lane = getProtocolPackageLane();
    const protocol = lane.packages.find(({ id }) => id === "settlement_protocol")!;
    protocol.internalDependencies.push("mmr");

    expect(() => validateProtocolPackageLane(lane)).toThrow("settlement_protocol must have no internal dependencies");
  });

  it("rejects Dojo and OpenZeppelin by Scarb-resolved package identity", () => {
    const lane = getProtocolPackageLane();
    const protocol = lane.packages.find(({ id }) => id === "settlement_protocol")!;
    protocol.dependencies.push("oz");
    protocol.dependencyPins.oz = '"2.0.0"';
    protocol.resolvedDependencies.push("openzeppelin");

    expect(() => validateProtocolPackageLane(lane)).toThrow(
      "settlement_protocol must remain free of Dojo and OpenZeppelin",
    );
  });

  it("pins every current protocol consumer to one compiler and test lane", () => {
    const lane = getProtocolPackageLane();
    const consumers = lane.packages.filter(({ role }) => role === "protocol-consumer");

    expect(consumers.map(({ id }) => id).sort()).toEqual(["factory", "game", "settlement_appchain"]);
    for (const consumer of consumers) {
      expect(consumer.cairoVersion, consumer.id).toBe("2.13.1");
      expect(consumer.starknetVersion, consumer.id).toBe("2.13.1");
      expect(consumer.snforgeVersion, consumer.id).toBe("0.51.2");
      expect(consumer.scarbVersion, consumer.id).toBe("2.13.1");
      expect(consumer.edition, consumer.id).toBe("2024_07");
      expect(consumer.dependencies, consumer.id).toContain("settlement_protocol");
      expect(consumer.lockSha256, consumer.id).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("derives protocol consumers from internal dependency paths", () => {
    const lane = getProtocolPackageLane();
    const derivedConsumers = lane.packages
      .filter(
        ({ internalDependencies, role }) =>
          role !== "dev-conformance" && internalDependencies.includes("settlement_protocol"),
      )
      .map(({ id }) => id)
      .sort();

    expect(derivedConsumers).toEqual(["factory", "game", "settlement_appchain"]);
    expect(lane.packages.find(({ id }) => id === "settlement_integration_tests")!.internalDependencies).toEqual([
      "collectibles",
      "collectibles_claim",
      "factory",
      "game",
      "lords",
      "mmr",
      "season_pass",
      "settlement_appchain",
      "settlement_protocol",
      "village_pass",
    ]);

    lane.packages.find(({ id }) => id === "mmr")!.internalDependencies.push("settlement_protocol");
    expect(() => validateProtocolPackageLane(lane)).toThrow("mmr protocol-consumer role disagrees");
  });

  it("publishes exact dependency and prebuilt-plugin pins", () => {
    const lane = getProtocolPackageLane();
    const game = lane.packages.find(({ id }) => id === "game")!;
    const factory = lane.packages.find(({ id }) => id === "factory")!;
    const collectibles = lane.packages.find(({ id }) => id === "collectibles")!;

    expect(game.dependencyPins.dojo).toBe('"1.8.0"');
    expect(game.dependencyPins.openzeppelin).toBe('"2.0.0"');
    expect(game.prebuiltPlugins).toEqual(["dojo_cairo_macros"]);
    expect(factory.dependencyPins.dojo).toBe('"1.8.0"');
    expect(factory.prebuiltPlugins).toEqual(["dojo_cairo_macros", "snforge_std"]);
    expect(collectibles.dependencyPins.openzeppelin).toBe('"=2.0.0"');
    expect(collectibles.dependencyPins.openzeppelin_utils).toBe('"=2.0.0"');

    for (const packageEntry of lane.packages) {
      expect(Object.keys(packageEntry.dependencyPins).sort(), packageEntry.id).toEqual(packageEntry.dependencies);
    }
  });

  it("uses the pinned released Cartridge VRF interface for cosmetics claims", () => {
    const lane = getProtocolPackageLane();
    const cosmeticsClaim = lane.packages.find(({ id }) => id === "collectibles_claim")!;
    const vrfReexport = readFileSync(
      new URL("../../../contracts/collectibles_claim/src/utils/cartridge.cairo", import.meta.url),
      "utf8",
    );

    expect(cosmeticsClaim.dependencyPins.cartridge_vrf).toContain('rev = "6d1c0f60a53558f19618b2bff81c3da0849db270"');
    expect(vrfReexport).toContain("pub use cartridge_vrf");
    expect(vrfReexport).not.toContain("pub trait IVrfProvider");
  });

  it("gives token and collectible packages explicit compatible pins", () => {
    const lane = getProtocolPackageLane();
    const explicitlyPinned = ["collectibles", "collectibles_claim", "lords", "mmr", "season_pass", "village_pass"];

    for (const name of explicitlyPinned) {
      const entry = lane.packages.find((candidate) => candidate.id === name)!;
      expect(entry.cairoVersion, name).toBe("2.13.1");
      expect(entry.scarbVersion, name).toBe("2.13.1");
      expect(entry.snforgeVersion, name).toBe("0.51.2");
    }
  });

  it("records the C7-owned season-resource migration as an explicit release blocker", () => {
    const lane = getProtocolPackageLane();
    const seasonResources = lane.packages.find(({ id }) => id === "season_resources")!;

    expect(seasonResources.role).toBe("deferred-migration");
    expect(seasonResources.deferredTo).toBe("C7");
    expect(seasonResources.releaseBlocking).toBe(true);
  });
});
