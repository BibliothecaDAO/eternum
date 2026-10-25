// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";

const { TileManager } = await import("@bibliothecadao/eternum");
const { frontierDay } = await import("@/ui/features/frontier/deploy/deploy-fixture");
const { default: HexceptionScene } = await import("./hexception");

const REALM = 7;
const REALM_TILE = { col: 5, row: 5 };

type Fixture = ReturnType<typeof frontierDay>;

/**
 * The realm view as a player holds it: realm 7 selected before the scene exists (as Frontier's one realm is from
 * entry), the scene following the game's facts as its constructor wires it, and each grid build recorded with the
 * castle level it was laid out for instead of drawn.
 */
const realmView = ({ store }: Fixture) => {
  const builds: { level: number; ringToLight: number | null }[] = [];
  const scene = Object.assign(Object.create(HexceptionScene.prototype), {
    game: { store },
    state: { structureEntityId: REALM, setSelectedBuildingHex: () => {} },
    structureStage: 0,
    newRingRadius: null,
    isEntered: true,
    isInitialized: true,
    destroyed: false,
    lastRealmKey: `${REALM_TILE.col},${REALM_TILE.row}`,
    hexceptionRadius: 4,
    shownMapHexes: new Set(),
    labels: [],
    buildingInstances: new Map(),
    wonderAuras: new Map(),
    buildingMixers: new Map(),
    scene: { add: () => {}, remove: () => {} },
    hoverLabelManager: { clear: () => {} },
    controls: {},
    tileManager: TileManager.forStructure(store, {} as never, REALM),
    gridBuilds: {
      start: () => builds.push({ level: scene.structureStage, ringToLight: scene.newRingRadius }),
    },
    // Entering the realm view again: the route names the realm, and the scene's presentation is already prepared.
    startLocalAssets: () => {},
    selectRouteStructure: () => ({
      structure: store.require("Structure", { game_id: 1, entity_id: REALM }),
      position: REALM_TILE,
    }),
    bootstrapSceneOwnership: () => {},
    moveCameraToURLLocation: () => {},
    standCameraAtPreferredZoom: () => {},
    getThunderBoltManager: () => ({ setConfig: () => {} }),
    localPresentation: Promise.resolve(),
    reconcileAllBuildingInstances: () => {},
  });
  const stop = store.subscribe((changes) => scene.answerFactChanges(changes));
  return { scene, builds, stop };
};

/** The contract's level_up, as Herald delivers it: realm 7's row with its level one higher. */
const raiseCastle = ({ store }: Fixture) => {
  const realm = store.require("Structure", { game_id: 1, entity_id: REALM });
  store.applyFacts([
    { model: "Structure", key: "0x7", value: { ...realm, base: { ...realm.base, level: realm.base.level + 1 } } },
  ] as never);
};

let view: ReturnType<typeof realmView> | undefined;
beforeEach(() => window.history.replaceState(null, "", "/g/0x1/1/hex?col=5&row=5"));
afterEach(() => view?.stop());

it("redraws an open realm view for a castle raised to City: its grid laid out at City, the new second ring lit", () => {
  const fixture = frontierDay();
  view = realmView(fixture);
  raiseCastle(fixture);
  expect(view.builds).toEqual([{ level: 1, ringToLight: 2 }]);
});

it("shows a castle raised while the player was on the map once they come back to the realm view", async () => {
  const fixture = frontierDay();
  view = realmView(fixture);
  view.scene.onSwitchOff();
  raiseCastle(fixture);
  expect(view.builds).toEqual([]);
  await view.scene.setup();
  expect(view.builds).toEqual([{ level: 1, ringToLight: 2 }]);
});

it("leaves the grid alone when the realm's row changes but its level does not", () => {
  const fixture = frontierDay();
  view = realmView(fixture);
  const realm = fixture.store.require("Structure", { game_id: 1, entity_id: REALM });
  fixture.store.applyFacts([{ model: "Structure", key: "0x7", value: { ...realm, resources_packed: "0x1" } }] as never);
  expect(view.builds).toEqual([]);
});
