import { type ComponentType, lazy, type LazyExoticComponent } from "react";

/** The games a page can draw; the lab's Game switch writes one into the address as `mode`. */
export type Mode = "blitz" | "frontier" | "eternum";
/** The devices a page can draw for; the lab's Device switch writes one into the address as `device`. */
export type Device = "desktop" | "phone" | "both";

export interface LabView {
  label: string;
  /** The address the lab opens it at. */
  path: string;
  /** Its route under /lab. */
  route: string;
  View: LazyExoticComponent<ComponentType>;
}
export interface LabPage {
  title: string;
  /** Its views, a tab each when there are several. */
  views: LabView[];
  /** The games it draws, the first the one it draws with no `mode` in its address; one or none, and no Game switch. */
  modes?: readonly Mode[];
  devices?: readonly Device[];
  /** Routes it opens inside itself (the HUD's frames), which belong to it but have no tab. */
  inside?: LabView[];
}
export interface LabRoom {
  title: string;
  pages: LabPage[];
}

/** A view's component, loaded only when the view is opened. */
function load<K extends string>(module: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(async () => ({ default: (await module())[name] }));
}
const view = (label: string, path: string, route: string, View: LazyExoticComponent<ComponentType>): LabView => ({
  label,
  path,
  route,
  View,
});

const BOTH: readonly Mode[] = ["blitz", "frontier"];
const FRONTIER: readonly Mode[] = ["frontier"];

/** Every route the HUD room's In game page draws in its frames, by address. */
const HUD_INSIDE = {
  state: view(
    "Frontier states",
    "/lab/kit/hud/idle",
    "kit/hud/:state",
    load(() => import("../ui/features/debug/kit-lab/hud-lab"), "HudLab"),
  ),
  desktop: view(
    "Desktop HUD",
    "/lab/kit/unified/frontier",
    "kit/unified/:view?",
    load(() => import("../ui/features/debug/kit-lab/unified-hud-lab"), "UnifiedHudLab"),
  ),
  panels: view(
    "Panels",
    "/lab/kit/panels",
    "kit/panels",
    load(() => import("../ui/features/debug/kit-lab/panels-lab"), "PanelsLab"),
  ),
  guidance: view(
    "Guidance",
    "/lab/kit/guidance",
    "kit/guidance",
    load(() => import("../ui/features/debug/kit-lab/guidance-lab"), "GuidanceLab"),
  ),
  buildOrder: view(
    "Build order",
    "/lab/kit/build-order",
    "kit/build-order",
    load(() => import("../ui/features/debug/kit-lab/build-order-lab"), "BuildOrderLab"),
  ),
  blitzBuild: view(
    "Build on a plot",
    "/lab/kit/blitz-build",
    "kit/blitz-build",
    load(() => import("../ui/features/debug/kit-lab/blitz-build-lab"), "BlitzBuildLab"),
  ),
  progression: view(
    "Research & army",
    "/lab/kit/progression",
    "kit/progression",
    load(() => import("../ui/features/debug/kit-lab/progression/progression-lab"), "ProgressionLab"),
  ),
  windows: view(
    "Windows",
    "/lab/kit/windows/build",
    "kit/windows/:surface?",
    load(() => import("../ui/features/debug/kit-lab/windows-lab"), "WindowsLab"),
  ),
  areaD: view(
    "Area D",
    "/lab/kit/area-d",
    "kit/area-d",
    load(() => import("../ui/features/debug/kit-lab/area-d-lab"), "AreaDLab"),
  ),
  deploy: view(
    "Deploy",
    "/lab/kit/deploy",
    "kit/deploy",
    load(() => import("../ui/features/debug/kit-lab/deploy-lab"), "DeployLab"),
  ),
  chat: view(
    "Chat",
    "/lab/kit/chat",
    "kit/chat",
    load(() => import("../ui/features/debug/kit-lab/chat-lab"), "ChatLab"),
  ),
  construction: view(
    "Construction",
    "/lab/kit/construction",
    "kit/construction",
    load(() => import("../ui/features/debug/kit-lab/construction-lab"), "ConstructionLab"),
  ),
};

/**
 * The lab, room by room (the owner's pick, 25 October 2026: six rooms). A lane adds a page as one entry here; the header,
 * each room's page list and the routes are drawn from it.
 */
export const ROOMS: LabRoom[] = [
  {
    title: "Kit",
    pages: [
      {
        title: "HUD sheet",
        modes: ["blitz", "frontier", "eternum"],
        devices: ["desktop", "phone"],
        views: [
          view(
            "Sheet",
            "/lab/kit",
            "kit",
            load(() => import("../ui/features/debug/kit-lab/style-sheet-lab"), "StyleSheetLab"),
          ),
          view(
            "Tokens",
            "/lab/kit/tokens",
            "kit/tokens",
            load(() => import("../ui/features/debug/kit-lab/tokens-lab"), "TokensLab"),
          ),
        ],
      },
      {
        title: "App sheet",
        views: [
          view(
            "Sheet",
            "/lab/kit/app",
            "kit/app",
            load(() => import("../ui/features/debug/kit-lab/app-lab/app-sheet-lab"), "AppSheetLab"),
          ),
          view(
            "Shell kit",
            "/lab/kit/shell",
            "kit/shell",
            load(() => import("../ui/features/debug/kit-lab/shell-kit-lab"), "ShellKitLab"),
          ),
          view(
            "Paintings",
            "/lab/kit/app-art",
            "kit/app-art",
            load(() => import("../ui/features/debug/kit-lab/app-art-lab"), "AppArtLab"),
          ),
        ],
      },
      {
        title: "Icons",
        views: [
          view(
            "Catalog",
            "/lab/kit/icons",
            "kit/icons",
            load(() => import("../ui/features/debug/kit-lab/icon-lab"), "IconLab"),
          ),
          view(
            "Resources",
            "/lab/kit/resource-icons",
            "kit/resource-icons",
            load(() => import("../ui/features/debug/kit-lab/resource-icons-lab"), "ResourceIconsLab"),
          ),
          view(
            "Chest tiers",
            "/lab/kit/reward-chests",
            "kit/reward-chests",
            load(() => import("../ui/features/debug/kit-lab/reward-chests-lab"), "RewardChestsLab"),
          ),
        ],
      },
      {
        title: "Words",
        views: [
          view(
            "Words",
            "/lab/kit/words",
            "kit/words",
            load(() => import("../ui/features/debug/kit-lab/words-lab"), "WordsLab"),
          ),
        ],
      },
      {
        title: "Motion",
        views: [
          view(
            "Motion",
            "/lab/motion",
            "motion",
            load(() => import("../ui/features/debug/motion-lab/motion-lab-view"), "MotionLabView"),
          ),
        ],
      },
    ],
  },
  {
    title: "HUD",
    pages: [
      {
        title: "In game",
        modes: ["frontier", "blitz"],
        devices: ["both", "desktop", "phone"],
        views: [
          view(
            "In game",
            "/lab/hud",
            "hud",
            load(() => import("./hud/view"), "HudRoomView"),
          ),
        ],
        inside: Object.values(HUD_INSIDE),
      },
      {
        title: "Phone panels · to pick",
        modes: ["frontier"],
        views: [
          view(
            "Phone panels",
            "/lab/kit/mobile-panels",
            "kit/mobile-panels",
            load(() => import("../ui/features/debug/kit-lab/mobile-panels/mobile-panels-lab"), "MobilePanelsLab"),
          ),
        ],
      },
      {
        title: "App pages",
        views: [
          view(
            "App pages",
            "/lab/app/home",
            "app/:screen/*",
            load(() => import("../shell/lab/app-lab"), "AppLabView"),
          ),
        ],
      },
    ],
  },
  {
    title: "Game",
    pages: [
      {
        title: "Spire",
        views: [
          view(
            "Spire",
            "/lab/game?scenario=spire",
            "game",
            load(() => import("./game/game-lab-view"), "GameLabView"),
          ),
        ],
      },
      {
        title: "Realm upgrade",
        views: [
          view(
            "Realm upgrade",
            "/lab/game?scenario=realm",
            "game",
            load(() => import("./game/game-lab-view"), "GameLabView"),
          ),
        ],
      },
      {
        title: "Painted buildings",
        views: [
          view(
            "Painted buildings",
            "/lab/game?scenario=painted-buildings",
            "game",
            load(() => import("./game/game-lab-view"), "GameLabView"),
          ),
        ],
      },
      {
        title: "Day end",
        modes: FRONTIER,
        views: [
          view(
            "Day end",
            "/lab/day-end",
            "day-end",
            load(() => import("./day-end/view"), "DayEndLabView"),
          ),
        ],
      },
      {
        title: "Game end",
        modes: BOTH,
        views: [
          view(
            "Game end",
            "/lab/endgame",
            "endgame",
            load(() => import("./endgame-mist/view"), "EndgameMistLabView"),
          ),
        ],
      },
      {
        title: "Chest opening",
        modes: BOTH,
        views: [
          view(
            "Chest opening",
            "/lab/relic-chest",
            "relic-chest",
            load(() => import("./relic-chest/view"), "RelicChestLab"),
          ),
        ],
      },
      {
        title: "Map labels & sites",
        modes: BOTH,
        views: [
          view(
            "Map labels",
            "/lab/map-labels",
            "map-labels",
            load(() => import("../ui/features/debug/map-label-lab/map-label-lab-view"), "MapLabelLabView"),
          ),
        ],
      },
    ],
  },
  {
    title: "Art",
    pages: [
      {
        title: "Terrain",
        modes: BOTH,
        views: [
          view(
            "Terrain & buildings",
            "/lab/terrain",
            "terrain",
            load(() => import("../ui/features/debug/procedural-terrain-debug-view"), "ProceduralTerrainDebugView"),
          ),
          view(
            "Props",
            "/lab/terrain-props",
            "terrain-props",
            load(() => import("../ui/features/debug/terrain-prop-debug-view"), "TerrainPropDebugView"),
          ),
        ],
      },
      {
        title: "Models",
        views: [
          view(
            "Models",
            "/lab/models",
            "models",
            load(() => import("../ui/features/debug/model-lab-view"), "ModelLabView"),
          ),
        ],
      },
      {
        title: "Characters",
        views: [
          view(
            "Characters",
            "/lab/characters",
            "characters",
            load(() => import("../ui/features/debug/procedural-character-gym-view"), "ProceduralCharacterGymView"),
          ),
        ],
      },
      {
        title: "Chests",
        views: [
          view(
            "Chests",
            "/lab/rewards",
            "rewards",
            load(() => import("../ui/features/debug/reward-lab-view"), "RewardLabView"),
          ),
        ],
      },
      {
        title: "Effects",
        views: [
          view(
            "Effects",
            "/lab/world-fx",
            "world-fx",
            load(() => import("../ui/features/debug/world-fx-gym-view"), "WorldFxGymView"),
          ),
        ],
      },
      {
        title: "Bench",
        views: [
          view(
            "Characters",
            "/lab/character-benchmark",
            "character-benchmark",
            load(
              () => import("../ui/features/debug/procedural-character-benchmark-view"),
              "ProceduralCharacterBenchmarkView",
            ),
          ),
          view(
            "World",
            "/lab/world",
            "world",
            load(() => import("../ui/features/debug/procedural-character-benchmark-view"), "ProceduralWorldGymView"),
          ),
          view(
            "Chunks",
            "/lab/chunks",
            "chunks",
            load(() => import("../ui/features/debug/three-chunk-debug-view"), "ThreeChunkDebugView"),
          ),
          view(
            "Terrain",
            "/lab/terrain-benchmark",
            "terrain-benchmark",
            load(
              () => import("../ui/features/debug/procedural-terrain-benchmark-view"),
              "ProceduralTerrainBenchmarkView",
            ),
          ),
        ],
      },
    ],
  },
  {
    title: "Data",
    pages: [
      {
        title: "Balance & data",
        modes: ["frontier", "blitz"],
        views: [
          view(
            "Balance & data",
            "/lab/data",
            "data",
            load(() => import("./data/view"), "DataRoomView"),
          ),
        ],
      },
    ],
  },
  {
    title: "Studio",
    pages: [
      {
        title: "Set",
        modes: BOTH,
        views: [
          view(
            "Set",
            "/lab/studio",
            "studio",
            load(() => import("./studio/view"), "StudioLabView"),
          ),
        ],
      },
      {
        title: "Footage",
        views: [
          view(
            "Footage",
            "/lab/footage",
            "footage",
            load(() => import("./footage/view"), "FootageView"),
          ),
        ],
      },
    ],
  },
];
