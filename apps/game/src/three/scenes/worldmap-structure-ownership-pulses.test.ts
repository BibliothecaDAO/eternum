import { type HexPosition, type ID } from "@bibliothecadao/types";
import { Color } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  WorldmapOwnershipPulsePresenter,
  type WorldmapOwnershipPulsePresenterDeps,
} from "./worldmap-structure-ownership-pulses";

function createDeps(overrides: Partial<WorldmapOwnershipPulsePresenterDeps> = {}) {
  const deps: WorldmapOwnershipPulsePresenterDeps = {
    clearOwnershipPulses: vi.fn(),
    showOwnershipPulses: vi.fn(),
    getStructureHex: vi.fn(() => undefined as HexPosition | undefined),
    getOwnedArmyHexes: vi.fn(() => [] as Array<HexPosition | null | undefined>),
    ...overrides,
  };
  return deps;
}

describe("WorldmapOwnershipPulsePresenter", () => {
  let deps: WorldmapOwnershipPulsePresenterDeps;
  let presenter: WorldmapOwnershipPulsePresenter;

  beforeEach(() => {
    deps = createDeps();
    presenter = new WorldmapOwnershipPulsePresenter(deps);
  });

  it("clears pulses when no structure is selected", () => {
    presenter.update(undefined);

    expect(deps.clearOwnershipPulses).toHaveBeenCalledTimes(1);
    expect(deps.showOwnershipPulses).not.toHaveBeenCalled();
    expect(deps.getStructureHex).not.toHaveBeenCalled();
  });

  it("clears pulses when the resolved footprint is empty", () => {
    presenter.update(42 as ID);

    expect(deps.getStructureHex).toHaveBeenCalledWith(42);
    expect(deps.getOwnedArmyHexes).toHaveBeenCalledWith(42);
    expect(deps.clearOwnershipPulses).toHaveBeenCalledTimes(1);
    expect(deps.showOwnershipPulses).not.toHaveBeenCalled();
  });

  it("shows one pulse position per resolved footprint hex", () => {
    deps = createDeps({
      getStructureHex: vi.fn(() => ({ col: 10, row: 10 })),
      getOwnedArmyHexes: vi.fn(() => [{ col: 11, row: 10 }]),
    });
    presenter = new WorldmapOwnershipPulsePresenter(deps);

    presenter.update(7 as ID);

    expect(deps.clearOwnershipPulses).not.toHaveBeenCalled();
    expect(deps.showOwnershipPulses).toHaveBeenCalledTimes(1);
    const [positions, base, pulse] = (deps.showOwnershipPulses as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(positions).toHaveLength(2);
    expect(positions[0]).toEqual(expect.objectContaining({ x: expect.any(Number), z: expect.any(Number) }));
    expect(base).toBeInstanceOf(Color);
    expect(pulse).toBeInstanceOf(Color);
  });

  it("drops suppressed hexes from the pulsed footprint", () => {
    deps = createDeps({
      getStructureHex: vi.fn(() => ({ col: 3, row: 3 })),
      getOwnedArmyHexes: vi.fn(() => [{ col: 4, row: 4 }]),
    });
    presenter = new WorldmapOwnershipPulsePresenter(deps);

    presenter.update(9 as ID, [], [{ col: 4, row: 4 }]);

    const [positions] = (deps.showOwnershipPulses as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(positions).toHaveLength(1);
  });

  it("caches colours per structure id across updates", () => {
    deps = createDeps({ getStructureHex: vi.fn(() => ({ col: 1, row: 1 })) });
    presenter = new WorldmapOwnershipPulsePresenter(deps);
    const show = deps.showOwnershipPulses as ReturnType<typeof vi.fn>;

    presenter.update(5 as ID);
    presenter.update(5 as ID);

    const [, firstBase, firstPulse] = show.mock.calls[0];
    const [, secondBase, secondPulse] = show.mock.calls[1];
    expect(secondBase).toBe(firstBase);
    expect(secondPulse).toBe(firstPulse);
  });

  it("derives distinct colours for distinct structure ids", () => {
    deps = createDeps({ getStructureHex: vi.fn(() => ({ col: 1, row: 1 })) });
    presenter = new WorldmapOwnershipPulsePresenter(deps);
    const show = deps.showOwnershipPulses as ReturnType<typeof vi.fn>;

    presenter.update(0 as ID);
    presenter.update(120 as ID);

    const [, baseA] = show.mock.calls[0];
    const [, baseB] = show.mock.calls[1];
    expect((baseA as Color).getHexString()).not.toEqual((baseB as Color).getHexString());
  });
});
