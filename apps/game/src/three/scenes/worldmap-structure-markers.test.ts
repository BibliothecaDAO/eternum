// @vitest-environment jsdom
import { ordersOfAspect, REALM_LEVELS, StructureType } from "@bibliothecadao/types";
import { Texture, Vector3, type InstancedMesh } from "three";
import { expect, it, vi } from "vitest";

import { HOME_KINDS, homeIcon, type HomeKind } from "@/ui/design-system/home-icons";
import { iconUrl } from "@/ui/design-system/icon-meaning";
import { StrategicMarkerLayer } from "../managers/strategic-marker-layer";
import { StructureManager } from "../managers/structure-manager";
import WorldmapScene from "./worldmap";

const homes = {
  realm: { hasWonder: false, realmOrder: undefined },
  "wonder-prowess": { hasWonder: true, realmOrder: ordersOfAspect(1)[0]!.orderId },
  "wonder-luminary": { hasWonder: true, realmOrder: ordersOfAspect(2)[0]!.orderId },
  "wonder-havoc": { hasWonder: true, realmOrder: ordersOfAspect(3)[0]!.orderId },
  "wonder-insight": { hasWonder: true, realmOrder: ordersOfAspect(4)[0]!.orderId },
} satisfies Record<HomeKind, { hasWonder: boolean; realmOrder?: number }>;

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
    mode: { id: "frontier" },
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
    const wonderId = kinds.indexOf("wonder-prowess") + 1;
    cached.get(wonderId)!.hasWonder = false;
    scene.writeStructureMarker(marker(wonderId));
    layer.commit();
    expect(pool("wonder-prowess").count).toBe(0);
    expect(pool("realm").count).toBe(2);
    expect(layer.metrics.structures).toBe(kinds.length);
    cached.get(wonderId)!.hasWonder = true;
    manager.mode = { id: "blitz" };
    scene.writeStructureMarker(marker(wonderId));
    layer.commit();
    expect(pool("wonder-prowess").count).toBe(1);
    expect(pool("realm").count).toBe(1);
    cached.get(wonderId)!.realmOrder = 0;
    scene.writeStructureMarker(marker(wonderId));
    layer.commit();
    expect(pool("wonder-prowess").count).toBe(0);
    expect(pool("realm").count).toBe(2);
  } finally {
    layer.dispose();
    canvas.mockRestore();
  }
});
