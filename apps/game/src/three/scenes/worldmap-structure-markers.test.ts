// @vitest-environment jsdom
import { REALM_LEVELS, StructureType } from "@bibliothecadao/types";
import { Texture, Vector3, type InstancedMesh } from "three";
import { expect, it, vi } from "vitest";

import { HOME_KINDS, homeIcon, type HomeKind } from "@/ui/design-system/home-icons";
import { iconUrl } from "@/ui/design-system/icon-meaning";
import { StrategicMarkerLayer } from "../managers/strategic-marker-layer";
import { StructureManager } from "../managers/structure-manager";
import type { RealmSkin } from "../structures/realm-skins";
import WorldmapScene from "./worldmap";

const homes = {
  realm: { hasWonder: false },
  wonder: { hasWonder: true },
  devcon: { hasWonder: false, realmSkin: "devcon" },
  "devcon-golden": { hasWonder: false, realmSkin: "devcon-golden" },
} satisfies Record<HomeKind, { hasWonder: boolean; realmSkin?: RealmSkin }>;

it("writes every far-view home to its own Settlement painting through the manager and scene, at every realm level", async () => {
  const kinds = Object.keys(HOME_KINDS) as HomeKind[];
  const cached = new Map(
    kinds.map((kind, index) => [
      index + 1,
      {
        ...homes[kind],
        structureType: StructureType.Realm,
        level: 0,
        owner: { address: 9n },
        isMine: false,
        isAlly: false,
      },
    ]),
  );
  const marker = (entityId: number) => ({ entityId, reserved: false, hexCoords: { col: entityId, row: 0 } });
  const manager = Object.assign(Object.create(StructureManager.prototype), {
    structureInfoCache: cached,
    worldSpatialProjection: { getStructure: marker },
    metrics: { structureInfoCacheHits: 0 },
  });
  const canvas = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const layer = new StrategicMarkerLayer({
    loadTexture: async (path) => {
      const texture = new Texture();
      texture.name = path;
      return texture;
    },
  });
  const scene = Object.assign(Object.create(WorldmapScene.prototype), {
    structureManager: manager,
    strategicMarkers: layer,
    resolveMarkerWorldPosition: ({ col, row }: { col: number; row: number }) => new Vector3(col, 0, row),
  }) as { writeStructureMarker: (structure: ReturnType<typeof marker>) => void };
  const pool = (kind: HomeKind) => layer.object3d.getObjectByName(`strategic-structure:${kind}`) as InstancedMesh;
  try {
    await Promise.resolve();
    for (const level of REALM_LEVELS.keys()) {
      for (const [entityId, info] of cached) {
        info.level = level;
        scene.writeStructureMarker(marker(entityId));
      }
      layer.commit();
      for (const kind of kinds) {
        expect(pool(kind), kind).toMatchObject({
          count: 1,
          visible: true,
          material: { map: { name: iconUrl(homeIcon(kind, 0)) } },
        });
      }
      expect(layer.metrics.structures).toBe(kinds.length);
    }
    // Reconciliation removes the previous identity instead of leaving two markers for the same home.
    const wonderId = kinds.indexOf("wonder") + 1;
    cached.get(wonderId)!.hasWonder = false;
    scene.writeStructureMarker(marker(wonderId));
    layer.commit();
    expect(pool("wonder").count).toBe(0);
    expect(pool("realm").count).toBe(2);
    expect(layer.metrics.structures).toBe(kinds.length);
  } finally {
    layer.dispose();
    canvas.mockRestore();
  }
});
