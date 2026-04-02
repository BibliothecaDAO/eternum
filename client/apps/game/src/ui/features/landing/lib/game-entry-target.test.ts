// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveKnownEntryTarget } from "./game-entry-target";

describe("resolveKnownEntryTarget", () => {
  it("prefers the known player world-map target before the fallback hex handoff", () => {
    expect(
      resolveKnownEntryTarget({
        isSpectateMode: false,
        uiStructureEntityId: 77,
        worldMapReturnPosition: { col: 12, row: 34 },
        blitzPlayerStructure: null,
        eternumOwnedStructure: null,
      }),
    ).toEqual({
      spectator: false,
      structureEntityId: 77,
      url: "/play/map?col=12&row=34",
      worldMapPosition: { col: 12, row: 34 },
    });
  });

  it("falls back to the first known blitz structure when no UI world-map target exists", () => {
    expect(
      resolveKnownEntryTarget({
        isSpectateMode: false,
        uiStructureEntityId: 0,
        worldMapReturnPosition: null,
        blitzPlayerStructure: { entityId: 91, col: 7, row: 9 },
        eternumOwnedStructure: null,
      }),
    ).toEqual({
      spectator: false,
      structureEntityId: 91,
      url: "/play/map?col=7&row=9",
      worldMapPosition: { col: 7, row: 9 },
    });
  });
});
