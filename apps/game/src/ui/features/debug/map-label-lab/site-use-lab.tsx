import { GameProvider } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { mountWorldmapSiteHarness, recordingSystemCalls, siteOfCall } from "@/three/debug/worldmap-site-harness";
import { MapSiteManager } from "@/three/managers/map-site-manager";
import type { MapPlateLayer } from "@/three/map-plates/map-plate-layer";
import type { TerrainSurface } from "@/three/terrain/terrain-surface";
import { getWorldPositionForHex, gltfLoader } from "@/three/utils/utils";
import { projectHexToScreen } from "@/three/utils/project-hex-to-screen";
import { worldHexAt } from "@/three/world-origin";
import { installActiveGameClient } from "@/sync/active-game-client";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { MapSiteCard, useSelectedMapSite } from "@/ui/features/frontier/sites/map-site-card";
import { sitesBeside, type SitesLayout } from "@/ui/features/frontier/sites/site-fixture";
import { FELT_CENTER } from "@/ui/config";
import type { GameClient } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import {
  disposeActiveGameSyncRuntime,
  installFreshGameSyncRuntime,
  WorldSpatialProjection,
} from "@bibliothecadao/eternum/game-sync";
import { getNeighborHexes, type HexPosition } from "@bibliothecadao/types";
import { useEffect, useState } from "react";
import { type Object3D, Plane, type PerspectiveCamera, type Scene, Vector3 } from "three";

import { installFixtureGame, PLAYER } from "../kit-lab/fixture-game";

/** The lab's army: the sites fixture's explorer 201, of the fixture player's realm 7. */
const ARMY = 201;

type LabWorld = {
  stage: { scene: Scene; camera: PerspectiveCamera; terrain: TerrainSurface };
  entities: readonly { ground: Vector3 }[];
};

/** What the evidence capture reads of the lab: the recorded calls, the army's tile, each site and where it is drawn. */
type SiteUseLabReport = {
  ready: boolean;
  recorded: unknown[];
  /** The map's selection: the army whose orders it shows and the hex its tile card names. */
  selection: () => { army: number | null; hex: { col: number; row: number } | null };
  armyTile: () => { col: number; row: number; alt: boolean } | null;
  sites: () => {
    name: string;
    tile: { col: number; row: number };
    standing: boolean;
    screen: { x: number; y: number };
  }[];
};

/**
 * `sites=1` on the map label lab: the world map's own Shrine and Well use over the lab's drawn world. West of the realm
 * block stand the sites fixture's army (a knight model, 40 of 150 stamina) with a Shrine and a Well beside it and a
 * Shrine three tiles off, the sites drawn by the game's MapSiteManager from their tiles. The world map's own input
 * and handlers take the canvas (worldmap-site-harness): a right-click or a touch held on a site beside the army uses
 * it, a click opens its card (the HUD's MapSiteCard) with the army kept, and the hovered tile shows the order line. A
 * use is the InteractSite call the real provider builds, recorded where the game would sign it; the chain's answer is
 * the lab's (the tile emptied), so the site goes. `window.__siteUseLab` reports it all for the evidence capture.
 */
export const SiteUseLab = ({
  world,
  canvasRef,
  plates,
  aim,
}: {
  world: LabWorld | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  plates: MapPlateLayer | null;
  aim: (target: Vector3) => void;
}) => {
  const [setup, setSetup] = useState<Pick<GameClientSetup, "store" | "systemCalls"> | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!world || !canvas || !plates) return;
    let disposed = false;
    const releases: (() => void)[] = [];
    const layout = siteLayout(world.entities);
    // The fixture's game first sets the map's centre, which turns the lab's hexes into the game's tiles.
    frontierDay();
    const center = FELT_CENTER();
    const tile = (hex: HexPosition) => ({ col: hex.col + center, row: hex.row + center, alt: false });
    const tiles: SitesLayout = {
      army: tile(layout.army),
      shrine: tile(layout.shrine),
      well: tile(layout.well),
      far: tile(layout.far),
    };
    let vacate: (tile: { col: number; row: number }) => void = () => {};
    const store = installFixtureGame(() => {
      const fixture = sitesBeside(40n, tiles);
      vacate = fixture.vacate;
      return fixture;
    });
    const projection = new WorldSpatialProjection({ store });
    installFreshGameSyncRuntime().installWorldSpatialProjection(projection);
    releases.push(() => disposeActiveGameSyncRuntime());
    const landed = new Map<string, { col: number; row: number }>();
    const sites = [tiles.shrine, tiles.well, tiles.far];
    const { systemCalls, recorded } = recordingSystemCalls((call, hash) => {
      const site = siteOfCall(call, ARMY, sites);
      if (site) landed.set(hash, site);
    });
    const labSetup = { store, systemCalls } as Pick<GameClientSetup, "store" | "systemCalls">;
    installActiveGameClient({
      setup: labSetup,
      connect() {},
      disconnect() {},
      dispose() {},
      visit() {},
      // The chain's answer, as the runtime applies a slice of facts: the site's tile emptied, then the projection's
      // changes published to the map and the HUD.
      waitForAction: async (hash: string) => {
        const site = landed.get(hash);
        if (site) vacate(site);
        projection.flush();
        return { hash, block: 0, status: "SUCCEEDED" };
      },
    } as unknown as GameClient);

    const siteModels = new MapSiteManager(
      world.stage.scene,
      projection,
      store,
      plates.createScope("shrine"),
      world.stage.terrain,
    );
    releases.push(() => siteModels.destroy());
    const ground = groundOf(world.stage.terrain, layout.army);
    void gltfLoader.loadAsync("/models/units/default_knight_lvl1.glb").then((gltf) => {
      if (disposed) return;
      const knight: Object3D = gltf.scene.clone();
      knight.position.copy(ground);
      knight.scale.setScalar(0.6);
      world.stage.scene.add(knight);
      releases.push(() => knight.removeFromParent());
    });
    aim(ground);

    // The pointer's tile: where its ray meets the ground the army stands on.
    const plane = new Plane(new Vector3(0, 1, 0), -ground.y);
    const hit = new Vector3();
    const harness = mountWorldmapSiteHarness({
      setup: labSetup,
      projection,
      surface: canvas,
      camera: world.stage.camera,
      mapPlates: plates,
      sites: siteModels,
      army: ARMY,
      player: BigInt(PLAYER),
      tileUnder: (raycaster) => (raycaster.ray.intersectPlane(plane, hit) ? worldHexAt(hit.x, hit.z) : null),
    });
    releases.push(() => harness.dispose());
    harness.selectArmy();
    setSetup(labSetup);

    const report: SiteUseLabReport = {
      ready: true,
      recorded,
      selection: () => {
        const { entityActions, selectedHex } = useUIStore.getState();
        return { army: entityActions.selectedEntityId ?? null, hex: selectedHex };
      },
      armyTile: () => {
        const at = store.entityOccupancy(1, ARMY);
        return at ? { col: at.col, row: at.row, alt: at.alt } : null;
      },
      sites: () =>
        (["shrine", "well", "far"] as const).map((name) => ({
          name,
          tile: tiles[name],
          standing: store.get("TileOccupancy", { game_id: 1, ...tiles[name] }) !== undefined,
          screen: projectHexToScreen(layout[name], world.stage.camera),
        })),
    };
    const page = window as { __siteUseLab?: SiteUseLabReport };
    page.__siteUseLab = report;
    releases.push(() => delete page.__siteUseLab);
    return () => {
      disposed = true;
      setSetup(null);
      releases.reverse().forEach((release) => release());
    };
  }, [world, canvasRef, plates, aim]);
  // The selected site's card, as the Frontier HUD's selection sheet draws it, for the lab's fixture player.
  return setup ? (
    <GameProvider value={setup as never} account={{ address: PLAYER, account: { address: PLAYER } } as never}>
      <SelectedSite />
    </GameProvider>
  ) : null;
};

const SelectedSite = () => {
  const site = useSelectedMapSite();
  return site ? <MapSiteCard selected={site} onClose={() => {}} /> : null;
};

/**
 * The army west of the realm block, on the westmost realm's row, with a Shrine and a Well on opposite sides of it and a
 * Shrine three tiles further west: tiles no fixture thing stands on.
 */
const siteLayout = (entities: LabWorld["entities"]) => {
  const taken = entities.map((entity) => worldHexAt(entity.ground.x, entity.ground.z));
  const westmost = taken.reduce((west, hex) => (hex.col < west.col ? hex : west));
  const army = { col: westmost.col - 4, row: westmost.row };
  const [shrine, , , well] = getNeighborHexes(army.col, army.row);
  return { army, shrine, well, far: { col: army.col - 3, row: army.row } };
};

const groundOf = (terrain: TerrainSurface, hex: HexPosition) => {
  const at = getWorldPositionForHex(hex);
  return at.setY(terrain.sampleSurface(at.x, at.z).height);
};
