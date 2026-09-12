import type { ClientComponents } from "@bibliothecadao/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => ({ structure: undefined as unknown, requirements: undefined as unknown }));
vi.mock("@dojoengine/recs", () => ({
  getComponentValue: (component: string) => (component === "structure" ? rows.structure : rows.requirements),
}));
vi.mock("@/sync/game-scope", () => ({ gameEntityKey: (key: bigint[]) => key.join(":") }));
import { readHyperstructureConstruction } from "./hyperstructure-state";

const components = {
  Hyperstructure: "structure",
  HyperstructureRequirements: "requirements",
} as unknown as ClientComponents;
beforeEach(() => {
  rows.structure = undefined;
  rows.requirements = undefined;
});

describe("hyperstructure construction from RECS", () => {
  it("holds the foundation until requirements arrive", () => {
    expect(readHyperstructureConstruction(components, 17)).toEqual({ entityId: 17, progress: 0, completed: false });
  });
  it("uses exact contribution totals without treating full funding as completion", () => {
    const total = 10n ** 30n;
    rows.requirements = { needed_resource_total: total, current_resource_total: total / 4n };
    expect(readHyperstructureConstruction(components, 17).progress).toBe(25);
    rows.requirements = { needed_resource_total: total, current_resource_total: total };
    expect(readHyperstructureConstruction(components, 17)).toEqual({ entityId: 17, progress: 100, completed: false });
    rows.structure = { completed: true };
    expect(readHyperstructureConstruction(components, 17).completed).toBe(true);
  });
  it("restores a completed snapshot even before its requirement row arrives", () => {
    rows.structure = { completed: true };
    expect(readHyperstructureConstruction(components, 17)).toEqual({ entityId: 17, progress: 100, completed: true });
  });
  it("rejects inconsistent contribution totals", () => {
    rows.requirements = { needed_resource_total: 0n, current_resource_total: 1n };
    expect(() => readHyperstructureConstruction(components, 17)).toThrow("contributions without resource requirements");
  });
});
