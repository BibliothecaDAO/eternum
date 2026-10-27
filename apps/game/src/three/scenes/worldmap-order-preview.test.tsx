// @vitest-environment jsdom
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { ActionPath } from "@bibliothecadao/eternum";
import { PerspectiveCamera } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/can-issue-orders", async (original) => ({
  ...(await original<typeof import("@/utils/can-issue-orders")>()),
  canIssueOrders: () => true,
  refusedBeforePlay: () => false,
}));

const { ActionPaths, ActionType, configManager, Position, setBlockTimestampSource } =
  await import("@bibliothecadao/eternum");
const { useAccountStore } = await import("@/hooks/store/use-account-store");
const { usePopoverStore } = await import("@/hooks/store/use-popover-store");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { default: WorldmapScene } = await import("./worldmap");
const { realmBoard } = await import("@/ui/features/frontier/build/build-fixture");
const { LeftView } = await import("@/types");
const { ActorType, Direction } = await import("@bibliothecadao/types");

const { ARMY_DEPLOYMENT_SURFACE_ID } = await import("@/ui/features/military/utils/open-army-deployment");

const FRONTIER_PRESET_ID = 5;
const BLITZ_PRESET_ID = 2;

const ARMY = 7;
/** The army's tile and the unexplored tile beside it, as the scene's hexes. */
const ARMY_HEX = { col: 4, row: 5 };
const BESIDE = { col: 5, row: 5 };

/** The army's orders: one step to the tile beside it, as this order. */
const pathsBeside = (actionType: ActionPath["actionType"], staminaCost = 20) =>
  new Map([
    [
      ActionPaths.posKey(BESIDE, true),
      [
        { hex: ARMY_HEX, actionType: ActionType.Move },
        { hex: BESIDE, actionType, staminaCost },
      ],
    ],
  ]);

/** The screen's width: a desktop at and above the HUD's desktop width, a phone below it. */
const screen = (desktop: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: desktop && query.includes("min-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

/**
 * The world map with an army selected beside a tile it can explore: the scene's own tap rule, order line and surfaces
 * run; what it draws on the canvas, and the send itself (`actAtHex`), are left out.
 */
const worldMap = (frontier: boolean) => {
  const camera = new PerspectiveCamera(30, 16 / 9, 1, 2000);
  camera.position.set(0, 40, 30);
  camera.lookAt(0, 0, 0);
  const sent: unknown[] = [];
  const pinned: unknown[] = [];
  /** The tiles whose facts (their order's line) a tap or a hold put up. */
  const facts: unknown[] = [];
  const scene = Object.assign(Object.create(WorldmapScene.prototype), {
    camera,
    orderRefusals: new Map(),
    exploredTiles: new Map(),
    game: { store: { get: () => undefined } },
    worldSpatialProjection: { getArmy: () => ({}), getStructuresAtHex: () => [] },
    pointerOrderTip: { take: () => {}, refresh: () => {} },
    state: {
      updateEntityActionHoveredHex: (hex: { col: number; row: number } | null) => {
        pinned.push(hex);
        useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, hoveredHex: hex } }));
      },
      updateEntityActionActionPaths: (actionPaths: Map<string, ActionPath[]>) =>
        useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, actionPaths } })),
    },
    isFrontierHud: () => frontier,
    queuesNextOrder: () => false,
    getHexagonEntity: () => ({}),
    actAtHex: (hex: unknown) => sent.push(hex),
    showTileFacts: (hex: unknown) => facts.push(hex),
  }) as {
    answerTapWithSelectedOrder: (hex: { col: number; row: number }) => boolean;
    updateEntityActionPaths: (actionPaths: Map<string, ActionPath[]>) => void;
  };
  return { scene, sent, pinned, facts };
};

beforeEach(() => {
  setBlockTimestampSource(() => 350);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // The map's canvas, where a surface over a tile hangs from.
  const canvas = document.createElement("canvas");
  canvas.id = "main-canvas";
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1440, height: 900 }) as DOMRect;
  document.body.replaceChildren(canvas);
  vi.spyOn(configManager, "getExploreStaminaCost").mockReturnValue(20);
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(2147483646);
  useUIStore.setState((state) => ({
    entityActions: {
      ...state.entityActions,
      selectedEntityId: ARMY,
      actionPaths: pathsBeside(ActionType.Explore),
      hoveredHex: null,
    },
  }));
  usePopoverStore.setState({ openId: null, surface: null });
});
afterEach(() => {
  setBlockTimestampSource(null);
  useAccountStore.setState({ account: null });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The surface the tap opened, drawn as the page draws it. */
const drawnSurface = () => {
  const surface = usePopoverStore.getState().surface;
  if (!surface) return null;
  const host = document.createElement("div");
  act(() => createRoot(host).render(<>{surface.content}</>));
  return { id: surface.id, host };
};

it.each([
  ["Frontier", true],
  ["Blitz", false],
])(
  "on a %s desktop, a click on a tile the army can explore opens the order there, and its verb sends it",
  (_, frontier) => {
    screen(true);
    const { scene, sent } = worldMap(frontier);

    expect(scene.answerTapWithSelectedOrder(BESIDE)).toBe(true);

    const drawn = drawnSurface();
    expect(drawn?.id).toBe("order-preview");
    const verb = [...drawn!.host.querySelectorAll("button")].find((button) => button.textContent === "Explore")!;
    expect(drawn!.host.textContent).toContain("20 stamina");
    expect(drawn!.host.textContent).toContain("A right-click sends it at once.");
    act(() => verb.click());
    expect(sent).toEqual([BESIDE]);
    expect(usePopoverStore.getState().surface).toBeNull();
  },
);

it("on a Frontier phone, a tap pins the order for the HUD's own verb, naming it at its tile, and opens no preview", () => {
  screen(false);
  const { scene, sent, pinned, facts } = worldMap(true);

  expect(scene.answerTapWithSelectedOrder(BESIDE)).toBe(true);

  expect(pinned).toEqual([BESIDE]);
  expect(facts).toEqual([BESIDE]);
  expect(usePopoverStore.getState().surface).toBeNull();
  expect(sent).toEqual([]);

  // Owner, 22 October 2026 (mobile direction A): the same tile again sends the pinned order.
  expect(scene.answerTapWithSelectedOrder(BESIDE)).toBe(true);
  expect(sent).toEqual([BESIDE]);
});

it("on a Frontier phone, a tap on a tile the rules refused says why there, and keeps the army", () => {
  screen(false);
  const { scene, sent, pinned, facts } = worldMap(true);
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, actionPaths: new Map() } }));
  (scene as unknown as { orderRefusals: Map<string, unknown> }).orderRefusals.set(ActionPaths.posKey(BESIDE, true), {
    reason: "stamina",
    need: 20,
  });

  expect(scene.answerTapWithSelectedOrder(BESIDE)).toBe(true);
  expect([facts, pinned, sent]).toEqual([[BESIDE], [], []]);
});

describe("a tap on a lit tile beside the realm selected", () => {
  const REALM = 9;
  const SOUTH_EAST = { col: 4, row: 4 };
  /** The realm's open tiles, as structurePaths lights them: one step out of the realm, to deploy there. */
  const deployTo = (tile: { col: number; row: number }): [string, ActionPath[]] => [
    ActionPaths.posKey(tile, true),
    [
      { hex: ARMY_HEX, actionType: ActionType.Move },
      { hex: tile, actionType: ActionType.CreateArmy },
    ],
  ];

  /** The game's preset, which picks its deploy surface (openArmyDeployment), with the realm selected and its tiles lit. */
  const playRealm = (presetId: number) => {
    const { store } = realmBoard();
    const game = store.require("GameRegistry", { game_id: 1 });
    store.applyFacts([{ model: "GameRegistry", key: "0x3", value: { ...game, preset_id: presetId } }] as never);
    useUIStore.setState((state) => ({
      entityActions: {
        ...state.entityActions,
        selectedEntityId: REALM,
        actionPaths: new Map([deployTo(BESIDE), deployTo(SOUTH_EAST)]),
      },
    }));
  };
  /** The map with the realm, not an army, selected. */
  const realmMap = (frontier: boolean) => {
    const map = worldMap(frontier);
    Object.assign(map.scene, { worldSpatialProjection: { getArmy: () => undefined, getStructuresAtHex: () => [] } });
    return map;
  };
  /** The deploy picker open over the map: the order it was opened with. */
  const pickerOrder = () => {
    const surface = usePopoverStore.getState().surface;
    return surface?.id === ARMY_DEPLOYMENT_SURFACE_ID ? (surface.content as ReactElement).props : null;
  };

  afterEach(() => {
    usePopoverStore.getState().close();
    useUIStore.getState().setPendingMilitaryAction(null);
    useUIStore.getState().setLeftNavigationView(LeftView.None);
  });

  it("on a Frontier phone, orders Frontier's Deploy sheet at that tile, and another lit tile aims it again", () => {
    playRealm(FRONTIER_PRESET_ID);
    screen(false);
    const { scene, sent } = realmMap(true);

    expect(scene.answerTapWithSelectedOrder(BESIDE)).toBe(true);
    expect(useUIStore.getState().leftNavigationView).toBe(LeftView.MilitaryView);
    expect(useUIStore.getState().pendingMilitaryAction).toEqual({
      structureId: REALM,
      isExplorer: true,
      direction: Direction.EAST,
    });
    expect(pickerOrder()).toBeNull();

    expect(scene.answerTapWithSelectedOrder(SOUTH_EAST)).toBe(true);
    expect(useUIStore.getState().pendingMilitaryAction?.direction).toBe(Direction.SOUTH_EAST);
    expect(sent).toEqual([]);
  });

  it("on a Blitz phone, opens Blitz's deploy picker at that tile, and a tap on another lit tile aims it there", () => {
    playRealm(BLITZ_PRESET_ID);
    screen(false);
    const { scene, sent } = realmMap(false);
    // The tile under the next finger, as the map's hexes name it.
    Object.assign(scene, {
      interactiveHexManager: { pick: () => ({ hexCoords: SOUTH_EAST }) },
      mapPlates: { thingHitBy: () => null },
      chunkTransitionToken: 1,
      actionPathsTransitionToken: 1,
    });

    expect(scene.answerTapWithSelectedOrder(BESIDE)).toBe(true);
    expect(pickerOrder()).toEqual({ structureId: REALM, isExplorer: true, direction: Direction.EAST });
    expect(useUIStore.getState().pendingMilitaryAction).toBeNull();
    expect(useUIStore.getState().leftNavigationView).toBe(LeftView.None);

    // The next tap lands on the map's canvas while the picker is open: the picker takes it (popover.tsx) and aims
    // there, and the map's own tap stands aside.
    const canvas = document.getElementById("main-canvas")!;
    const tap = new PointerEvent("pointerdown", { clientX: 700, clientY: 500 });
    Object.defineProperty(tap, "target", { value: canvas });
    const { mapClick } = usePopoverStore.getState().surface!;
    expect(mapClick !== undefined && mapClick !== "dismiss" && mapClick.reanchor(tap)).toBe(true);
    (scene as unknown as { onHexagonClick: (hex: unknown) => void }).onHexagonClick(SOUTH_EAST);

    expect(pickerOrder()).toEqual({ structureId: REALM, isExplorer: true, direction: Direction.SOUTH_EAST });
    expect(useUIStore.getState().entityActions.selectedEntityId).toBe(REALM);
    expect(sent).toEqual([]);
  });

  it("on a desktop, leaves the click its own tap and opens nothing (owner: right-click deploys there)", () => {
    playRealm(FRONTIER_PRESET_ID);
    screen(true);
    const { scene, sent } = realmMap(true);

    expect(scene.answerTapWithSelectedOrder(BESIDE)).toBe(false);
    expect(useUIStore.getState().pendingMilitaryAction).toBeNull();
    expect(useUIStore.getState().leftNavigationView).toBe(LeftView.None);
    expect([usePopoverStore.getState().surface, sent]).toEqual([null, []]);
  });
});

/** The preview's verb button, by its words. */
const verbOf = (host: HTMLElement, words: string) =>
  [...host.querySelectorAll("button")].find((button) => button.textContent === words)!;

describe("an open preview whose order changes before its verb is pressed", () => {
  beforeEach(() => screen(true));

  it.each([
    [
      "another player's reveal turns the explore into a move",
      (scene: ReturnType<typeof worldMap>["scene"]) => scene.updateEntityActionPaths(pathsBeside(ActionType.Move, 10)),
    ],
    [
      "another army is selected",
      (scene: ReturnType<typeof worldMap>["scene"]) => {
        useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: ARMY + 1 } }));
        scene.updateEntityActionPaths(pathsBeside(ActionType.Explore));
      },
    ],
    [
      "the tile leaves the army's reach",
      (scene: ReturnType<typeof worldMap>["scene"]) => scene.updateEntityActionPaths(new Map()),
    ],
  ])("closes when %s, and its old verb sends nothing", (_, change) => {
    const { scene, sent } = worldMap(true);
    scene.answerTapWithSelectedOrder(BESIDE);
    const drawn = drawnSurface()!;

    change(scene);

    expect(usePopoverStore.getState().surface).toBeNull();
    act(() => verbOf(drawn.host, "Explore").click());
    expect(sent).toEqual([]);
  });

  it("sends nothing when the order's cost changed before the map heard of it", () => {
    const { scene, sent } = worldMap(true);
    scene.answerTapWithSelectedOrder(BESIDE);
    const drawn = drawnSurface()!;
    expect(drawn.host.textContent).toContain("20 stamina");

    // The orders are planned again at another cost, and the verb is pressed before the scene hears of it.
    useUIStore.setState((state) => ({
      entityActions: { ...state.entityActions, actionPaths: pathsBeside(ActionType.Explore, 25) },
    }));
    act(() => verbOf(drawn.host, "Explore").click());

    expect(sent).toEqual([]);
  });

  it("stays open, and sends its order, when the orders are planned again the same", () => {
    const { scene, sent } = worldMap(true);
    scene.answerTapWithSelectedOrder(BESIDE);
    const drawn = drawnSurface()!;

    scene.updateEntityActionPaths(pathsBeside(ActionType.Explore));

    expect(usePopoverStore.getState().surface?.id).toBe("order-preview");
    act(() => verbOf(drawn.host, "Explore").click());
    expect(sent).toEqual([BESIDE]);
  });
});

it.each([ActionType.Explore, ActionType.Move, ActionType.Attack, ActionType.Help, ActionType.Chest])(
  "on a Frontier phone, a hold on %s shows facts without sending",
  (actionType) => {
    useUIStore.setState((state) => ({
      entityActions: { ...state.entityActions, actionPaths: pathsBeside(actionType) },
    }));
    screen(false);
    const { scene, sent, facts } = worldMap(true);
    const rightClick = scene as unknown as { onHexagonRightClick: (event: MouseEvent, hex: unknown) => void };

    // The touch recognizer gives a hold as a right-click a finger made (input-manager.test.ts: a long press).
    rightClick.onHexagonRightClick(new PointerEvent("contextmenu", { pointerType: "touch" }), BESIDE);
    expect([facts, sent]).toEqual([[BESIDE], []]);
  },
);

it("on a Frontier phone, holding the spire opens its depth choice with the army kept and sends nothing", () => {
  screen(false);
  vi.spyOn(configManager, "isCommandEnabled").mockReturnValue(true);
  useAccountStore.setState({ account: { address: "0x111" } as never });
  useUIStore.setState((state) => ({
    entityActions: { ...state.entityActions, actionPaths: pathsBeside(ActionType.EnterDepth) },
  }));
  const { scene, sent, facts } = worldMap(true);
  const prototype = WorldmapScene.prototype as unknown as { actAtHex: (hex: unknown) => void };
  const actual = Object.assign(scene, {
    actAtHex: prototype.actAtHex,
    state: useUIStore.getState(),
    chunkTransitionToken: 1,
    actionPathsTransitionToken: 1,
    getInteractionDebugSnapshot: () => ({}),
  }) as unknown as { onHexagonRightClick: (event: MouseEvent, hex: unknown) => void };

  actual.onHexagonRightClick(new PointerEvent("contextmenu", { pointerType: "touch" }), BESIDE);

  expect(useUIStore.getState().mapSelection).toEqual({ kind: "army", entityId: ARMY, tile: BESIDE });
  expect(useUIStore.getState().selectedHex).toEqual(BESIDE);
  expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
  expect([facts, sent]).toEqual([[], []]);
});

describe("an army selected on a desktop keeps its actions one click away (owner, 27 October 2026)", () => {
  const MONSTER = 99;
  const FAR = { col: 12, row: 9 };
  const contract = (hex: { col: number; row: number }) => {
    const at = Position.fromNormalized({ x: hex.col, y: hex.row }).getContract();
    return { col: at.x, row: at.y };
  };

  /**
   * The map with the army selected and a monster beside it that the army's stamina can't attack yet, as the planner
   * refuses it: no order there, its reason recorded. Every way the map selects goes through `selectOnMap` and
   * `clearEntitySelection`, recorded here.
   */
  const lowStaminaMap = (frontier: boolean) => {
    const map = worldMap(frontier);
    const selections: unknown[] = [];
    const cleared: number[] = [];
    useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, actionPaths: new Map() } }));
    const entities = new Map([
      [ActionPaths.posKey(BESIDE), { army: { id: MONSTER, owner: 0x999n } }],
      [ActionPaths.posKey(ARMY_HEX), { army: { id: ARMY, owner: 0x111n } }],
    ]);
    Object.assign(map.scene, {
      worldSpatialProjection: { getArmy: () => ({ hexCoords: contract(ARMY_HEX) }), getStructuresAtHex: () => [] },
      getHexagonEntity: (hex: { col: number; row: number }) => entities.get(ActionPaths.posKey(hex)) ?? {},
      getOwnArmyOrderedTo: () => undefined,
      logInteractionDebug: () => {},
      getInteractionDebugSnapshot: () => ({}),
      interactionAdapter: { selectHex: () => {} },
      state: {
        ...(map.scene as unknown as { state: object }).state,
        selectOnMap: (intent: unknown) => selections.push(intent),
      },
      clearEntitySelection: () => cleared.push(1),
    });
    (map.scene as unknown as { orderRefusals: Map<string, unknown> }).orderRefusals.set(
      ActionPaths.posKey(BESIDE, true),
      { reason: "stamina", need: 20 },
    );
    const scene = map.scene as unknown as {
      onHexagonRightClick: (event: MouseEvent, hex: { col: number; row: number }) => void;
      onHexagonClick: (hex: { col: number; row: number }) => void;
    };
    return { ...map, scene, selections, cleared };
  };
  const rightClick = () => new MouseEvent("contextmenu", { button: 2 });

  beforeEach(() => {
    vi.spyOn(configManager, "isCommandEnabled").mockReturnValue(true);
  });
  afterEach(() => usePopoverStore.getState().close());

  it("in Blitz, a right-click on a monster the army lacks the stamina to attack opens the attack's preview there", () => {
    screen(true);
    const { scene, sent, cleared } = lowStaminaMap(false);

    scene.onHexagonRightClick(rightClick(), BESIDE);

    const surface = usePopoverStore.getState().surface!;
    expect(surface.id).toBe("quick-attack");
    const { attacker, target } = (surface.content as ReactElement<{ attacker: unknown; target: unknown }>).props;
    expect(attacker).toEqual({
      type: ActorType.Explorer,
      id: ARMY,
      hex: { x: contract(ARMY_HEX).col, y: contract(ARMY_HEX).row },
      alt: false,
    });
    expect(target).toEqual({
      type: ActorType.Explorer,
      id: MONSTER,
      hex: { x: contract(BESIDE).col, y: contract(BESIDE).row },
      alt: false,
    });
    expect([sent, cleared, useUIStore.getState().entityActions.selectedEntityId]).toEqual([[], [], ARMY]);
  });

  it("in Frontier, the same right-click opens the monster's tile card with the army as its actor", () => {
    screen(true);
    const { scene, selections, cleared } = lowStaminaMap(true);

    scene.onHexagonRightClick(rightClick(), BESIDE);

    expect(selections).toEqual([{ kind: "army", entityId: ARMY, tile: contract(BESIDE) }]);
    expect(cleared).toEqual([]);
  });

  it("a right-click on a tile the army lacks the stamina to explore opens Explore there, disabled, with why", () => {
    screen(true);
    const { scene, sent, cleared } = lowStaminaMap(false);
    const fog = { col: 4, row: 6 };
    (scene as unknown as { orderRefusals: Map<string, unknown> }).orderRefusals.set(ActionPaths.posKey(fog, true), {
      reason: "stamina",
      need: 20,
    });

    scene.onHexagonRightClick(rightClick(), fog);

    const drawn = drawnSurface()!;
    expect(drawn.id).toBe("order-preview");
    // The stub's store holds no army row, so what the army holds reads as unknown.
    expect(drawn.host.querySelector("[role=alert]")?.textContent).toBe("Needs 20 stamina, have —");
    expect(verbOf(drawn.host, "Explore").disabled).toBe(true);
    expect(drawn.host.textContent).not.toContain("A right-click sends it at once.");
    expect([sent, cleared]).toEqual([[], []]);
  });

  it("a right-click on a tile the army can explore still sends it at once", () => {
    screen(true);
    const { scene, sent } = lowStaminaMap(false);
    useUIStore.setState((state) => ({
      entityActions: { ...state.entityActions, actionPaths: pathsBeside(ActionType.Explore) },
    }));

    scene.onHexagonRightClick(rightClick(), BESIDE);

    expect(sent).toEqual([BESIDE]);
  });

  it("a move its stamina no longer pays for when sent says so and keeps the army", () => {
    screen(true);
    const { scene, sent, cleared } = lowStaminaMap(false);
    const dropped: number[] = [];
    Object.assign(scene, {
      hasOrderInFlight: () => false,
      resolveMovementStaminaForAction: () => ({ canAfford: false, currentStamina: 5, staminaCost: 20 }),
      logBlockedMovementStamina: () => {},
      clearSelection: () => dropped.push(1),
    });

    (scene as unknown as { onArmyMovement: (path: ActionPath[], army: number) => void }).onArmyMovement(
      pathsBeside(ActionType.Move).get(ActionPaths.posKey(BESIDE, true))!,
      ARMY,
    );

    expect([sent, cleared, dropped]).toEqual([[], [], []]);
  });

  /** The preview open over the map: its verb, whether it can be pressed, and the reason it shows. */
  const shownPreview = () => {
    const drawn = drawnSurface();
    if (drawn?.id !== "order-preview") return null;
    const verb = drawn.host.querySelector("button:not([aria-label])") as HTMLButtonElement;
    return {
      verb: verb.textContent,
      disabled: verb.disabled,
      reason: drawn.host.querySelector("[role=alert]")?.textContent,
    };
  };

  describe.each([
    ["Frontier", true],
    ["Blitz", false],
  ])("in %s, a tile far beyond the army's routes, which the rules said nothing of", (_, frontier) => {
    it("a right-click on revealed land opens Move there, disabled, too far", () => {
      screen(true);
      const { scene, sent, selections, cleared } = lowStaminaMap(frontier);
      (scene as unknown as { exploredTiles: Map<number, Set<number>> }).exploredTiles.set(FAR.col, new Set([FAR.row]));

      scene.onHexagonRightClick(rightClick(), FAR);

      expect(shownPreview()).toEqual({ verb: "Move", disabled: true, reason: "Too far: move closer" });
      expect([sent, selections, cleared, useUIStore.getState().entityActions.selectedEntityId]).toEqual([
        [],
        [],
        [],
        ARMY,
      ]);
    });

    it("a right-click in the fog opens Explore there, disabled, too far", () => {
      screen(true);
      const { scene, sent, cleared } = lowStaminaMap(frontier);

      scene.onHexagonRightClick(rightClick(), FAR);

      expect(shownPreview()).toEqual({ verb: "Explore", disabled: true, reason: "Too far: move closer" });
      expect([sent, cleared]).toEqual([[], []]);
    });

    it("a left-click there opens the same, keeping the army", () => {
      screen(true);
      const { scene, sent, selections, cleared } = lowStaminaMap(frontier);

      scene.onHexagonClick(FAR);

      expect(shownPreview()).toEqual({ verb: "Explore", disabled: true, reason: "Too far: move closer" });
      expect([sent, selections, cleared]).toEqual([[], [], []]);
    });
  });

  it("a click on a tile whose order the click leaves to the map keeps the army and opens that tile for it", () => {
    screen(true);
    const { scene, selections, cleared } = lowStaminaMap(true);
    // Travel through another spire: an order the right-click gives, which a click leaves to the map.
    const spire = { col: 3, row: 5 };
    const travel = [
      { hex: ARMY_HEX, actionType: ActionType.Move },
      { hex: spire, actionType: ActionType.SpireTravel },
    ];
    useUIStore.setState((state) => ({
      entityActions: { ...state.entityActions, actionPaths: new Map([[ActionPaths.posKey(spire, true), travel]]) },
    }));

    scene.onHexagonClick(spire);

    expect(selections).toEqual([{ kind: "army", entityId: ARMY, tile: contract(spire) }]);
    expect(cleared).toEqual([]);
  });

  it("on a phone, the same tap still lets the army go, as before", () => {
    screen(false);
    const { scene, selections, cleared } = lowStaminaMap(false);

    scene.onHexagonClick(FAR);

    expect([selections, cleared]).toEqual([[], [1]]);
  });
});
