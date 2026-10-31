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
  /** The army the map draws as selected, and the route it previews (its tiles, or null), after each change. */
  const routes: unknown[] = [];
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
    armyManager: {
      setSelectedArmy: () => {},
      previewRoute: (army: unknown, route: { getContract: () => { x: number; y: number } }[] | null) =>
        routes.push({
          army,
          route:
            route?.map((tile) => ({ col: Number(tile.getContract().x), row: Number(tile.getContract().y) })) ?? null,
        }),
    },
    actAtHex: (hex: unknown) => sent.push(hex),
    showTileFacts: (hex: unknown) => facts.push(hex),
  }) as {
    answerTapWithSelectedOrder: (hex: { col: number; row: number }) => boolean;
    updateEntityActionPaths: (actionPaths: Map<string, ActionPath[]>) => void;
  };
  return { scene, sent, pinned, facts, routes };
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

it("on a Blitz phone, a tap on a tile the army can explore opens the order there, and its verb sends it", () => {
  screen(false);
  const { scene, sent } = worldMap(false);

  expect(scene.answerTapWithSelectedOrder(BESIDE)).toBe(true);

  const drawn = drawnSurface();
  expect(drawn?.id).toBe("order-preview");
  const verb = [...drawn!.host.querySelectorAll("button")].find((button) => button.textContent === "Explore")!;
  expect(drawn!.host.textContent).toBe("20 stamina" + "Explore");
  act(() => verb.click());
  expect(sent).toEqual([BESIDE]);
  expect(usePopoverStore.getState().surface).toBeNull();
});

// Owner, 27 October 2026: "Yes double tapping to explore on mobile"; Next up teaches it ("Double-tap a tile beside your
// army", frontier-coach.ts).
it("on a Frontier phone, a double tap on a tile beside the army explores it: the first tap pins it for the HUD's bar alone", () => {
  screen(false);
  const { scene, sent, pinned, facts } = worldMap(true);

  expect(scene.answerTapWithSelectedOrder(BESIDE)).toBe(true);

  expect(pinned).toEqual([BESIDE]);
  expect(facts).toEqual([]);
  expect(usePopoverStore.getState().surface).toBeNull();
  expect(sent).toEqual([]);

  expect(scene.answerTapWithSelectedOrder(BESIDE)).toBe(true);
  expect(sent).toEqual([BESIDE]);
});

// Audit 10-27 (phone): "shows two answers at once", the transfer sheet kept open under a new order pinned on the map.
it("on a Frontier phone, a pin puts away the card of the tile the army acted on before: one answer on screen", () => {
  screen(false);
  const { scene, pinned, facts, sent } = worldMap(true);
  const actedOn = { col: 9, row: 9 };
  Object.assign(scene, {
    state: {
      ...(scene as unknown as { state: object }).state,
      selectOnMap: useUIStore.getState().selectOnMap,
    },
  });
  useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: actedOn });

  scene.answerTapWithSelectedOrder(BESIDE);

  expect(useUIStore.getState().mapSelection).toEqual({ kind: "army", entityId: ARMY, tile: "own" });
  expect(pinned).toEqual([BESIDE]);
  expect(facts).toEqual([]);
  expect(usePopoverStore.getState().surface).toBeNull();
  expect(sent).toEqual([]);
  expect(scene.answerTapWithSelectedOrder(BESIDE)).toBe(true);
  expect(sent).toEqual([BESIDE]);
  useUIStore.getState().selectOnMap(null);
});

it.each([
  ["a Frontier phone", false, ["ringed", "none"]],
  ["a desktop", true, ["none", "none"]],
])(
  "on %s, the pinned order's tile wears the order's ring, and the army's route there its trail, until the pin goes",
  (_, desktop, ringed) => {
    screen(desktop);
    const { scene, routes } = worldMap(true);
    const rings: string[] = [];
    Object.assign(scene, {
      isInteractionOwner: () => true,
      isSceneExitInteractionResetInProgress: false,
      isMissingActionPathOwnershipState: () => false,
      syncEntityActionPathsTransitionToken: () => {},
      logInteractionDebug: () => {},
      getInteractionDebugSnapshot: () => ({}),
      deployTileOf: () => null,
      orderTargetRing: {
        setHoverColor: () => {},
        showHover: () => rings.push("ringed"),
        hideHover: () => rings.push("none"),
      },
    });
    const storeUpdate = scene as unknown as {
      handleEntityActionsStoreUpdate: (next: object, previous: object) => void;
    };
    const actions = useUIStore.getState().entityActions;

    useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, hoveredHex: BESIDE } }));
    storeUpdate.handleEntityActionsStoreUpdate({ ...actions, hoveredHex: BESIDE }, { ...actions, hoveredHex: null });
    useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, hoveredHex: null } }));
    storeUpdate.handleEntityActionsStoreUpdate({ ...actions, hoveredHex: null }, { ...actions, hoveredHex: BESIDE });

    expect(rings).toEqual(ringed);
    // The explore beside the army previews its walk there (from where it stands), and the pin's going takes it away.
    expect(routes).toEqual([
      { army: ARMY, route: [ARMY_HEX, BESIDE] },
      { army: ARMY, route: null },
    ]);
  },
);

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
  beforeEach(() => screen(false));

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
    const { scene, sent } = worldMap(false);
    scene.answerTapWithSelectedOrder(BESIDE);
    const drawn = drawnSurface()!;

    change(scene);

    expect(usePopoverStore.getState().surface).toBeNull();
    act(() => verbOf(drawn.host, "Explore").click());
    expect(sent).toEqual([]);
  });

  it("sends nothing when the order's cost changed before the map heard of it", () => {
    const { scene, sent } = worldMap(false);
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
    const { scene, sent } = worldMap(false);
    scene.answerTapWithSelectedOrder(BESIDE);
    const drawn = drawnSurface()!;

    scene.updateEntityActionPaths(pathsBeside(ActionType.Explore));

    expect(usePopoverStore.getState().surface?.id).toBe("order-preview");
    act(() => verbOf(drawn.host, "Explore").click());
    expect(sent).toEqual([BESIDE]);
  });
});

it.each([ActionType.Explore, ActionType.Move, ActionType.Attack, ActionType.Chest])(
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

    it("a left-click there lets the army go and opens nothing", () => {
      screen(true);
      const { scene, sent, cleared } = lowStaminaMap(frontier);

      scene.onHexagonClick(FAR);

      expect([shownPreview(), sent, cleared]).toEqual([null, [], [1]]);
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

  // Owner, 27 October 2026: "Left clicking should remove the selected army/structure".
  it.each([
    ["Frontier", true],
    ["Blitz", false],
  ])("in %s, a click on bare ground the army could explore lets it go and orders nothing", (_, frontier) => {
    screen(true);
    const { scene, sent, selections, cleared } = lowStaminaMap(frontier);
    const fog = { col: 4, row: 4 };
    useUIStore.setState((state) => ({
      entityActions: {
        ...state.entityActions,
        actionPaths: new Map([
          [
            ActionPaths.posKey(fog, true),
            [
              { hex: ARMY_HEX, actionType: ActionType.Move },
              { hex: fog, actionType: ActionType.Explore, staminaCost: 20 },
            ],
          ],
        ]),
      },
    }));

    scene.onHexagonClick(fog);

    expect([usePopoverStore.getState().surface, sent, selections, cleared]).toEqual([null, [], [], [1]]);
  });

  it("a click on the monster beside it keeps the army and opens the monster's card for it", () => {
    screen(true);
    const { scene, selections, cleared } = lowStaminaMap(true);

    scene.onHexagonClick(BESIDE);

    expect(selections).toEqual([{ kind: "army", entityId: ARMY, tile: contract(BESIDE) }]);
    expect(cleared).toEqual([]);
  });

  it("on a phone, the same tap still lets the army go, as before", () => {
    screen(false);
    const { scene, selections, cleared } = lowStaminaMap(false);

    scene.onHexagonClick(FAR);

    expect([selections, cleared]).toEqual([[], [1]]);
  });
});

/**
 * What a click or a tap does, by what is selected and what it lands on (owner, 27 October 2026: "Left clicking should
 * remove the selected army/structure"; "when i click this but then click another army without deploying we should
 * close the deploy and bring up the selected army"). Every cell runs the map's own click, tap and right-click.
 */
describe("the click matrix: what is selected × what is clicked", () => {
  const OTHER_ARMY = 8;
  const FAR_ARMY = 10;
  const SPIRE_ARMY_ON_IT = 11;
  const CLEARED_ARMY = 12;
  const REALM = 9;
  const ENEMY = 99;
  const OTHER_REALM = 98;
  /** Another player's realm, beside none of the player's things: off the matrix's columns. */
  const OTHER_REALM_TILE = { col: 11, row: 3 };
  const OWN = 0x111n;
  const tiles = {
    "your army beside": { col: 3, row: 5 },
    "your army far": { col: 9, row: 9 },
    "your realm beside": { col: 4, row: 4 },
    // Owner, 28 October 2026 (brief item 2): a tap on a tile with his army on it selects the army, whatever site is
    // under it: the realm's spire, a cleared site.
    "your army on its spire": { col: 6, row: 2 },
    "your army on a cleared site": { col: 7, row: 7 },
    "enemy army": BESIDE,
    "bare ground in reach": { col: 4, row: 6 },
    "bare ground far": { col: 12, row: 9 },
  } as const;
  type Clicked = keyof typeof tiles;
  type Selected = "nothing" | "army" | "realm";
  const key = (hex: { col: number; row: number }) => ActionPaths.posKey(hex);
  const contract = (hex: { col: number; row: number }) => {
    const at = Position.fromNormalized({ x: hex.col, y: hex.row }).getContract();
    return { col: at.x, row: at.y };
  };
  /** The selected army's order at a tile: one step from its own tile. */
  const order = (tile: { col: number; row: number }, actionType: ActionPath["actionType"]): [string, ActionPath[]] => [
    ActionPaths.posKey(tile, true),
    [
      { hex: contract(ARMY_HEX), actionType: ActionType.Move },
      { hex: contract(tile), actionType, staminaCost: 20 },
    ],
  ];

  /**
   * The map with the player's three armies (one selectable beside the first, one out of its reach) and realm beside
   * it, an enemy army beside it, and the selection given. The first army's orders are the planner's: a transfer to the
   * army and the realm beside it, an attack, an explore, and its reason for the army out of reach.
   */
  const mapWith = (selected: Selected, frontier: boolean) => {
    const map = worldMap(frontier);
    const did: string[] = [];
    const entities = new Map<string, object>([
      [key(ARMY_HEX), { army: { id: ARMY, owner: OWN } }],
      [key(tiles["your army beside"]), { army: { id: OTHER_ARMY, owner: OWN } }],
      [key(tiles["your army far"]), { army: { id: FAR_ARMY, owner: OWN } }],
      [key(tiles["your realm beside"]), { structure: { id: REALM, owner: OWN } }],
      [key(tiles["your army on its spire"]), { army: { id: SPIRE_ARMY_ON_IT, owner: OWN } }],
      [key(tiles["your army on a cleared site"]), { army: { id: CLEARED_ARMY, owner: OWN } }],
      [key(tiles["enemy army"]), { army: { id: ENEMY, owner: 0x999n } }],
      [key(OTHER_REALM_TILE), { structure: { id: OTHER_REALM, owner: 0x999n } }],
    ]);
    const armies = new Map([
      [ARMY, ARMY_HEX],
      [OTHER_ARMY, tiles["your army beside"]],
      [FAR_ARMY, tiles["your army far"]],
      [SPIRE_ARMY_ON_IT, tiles["your army on its spire"]],
      [CLEARED_ARMY, tiles["your army on a cleared site"]],
    ]);
    const cleared = contract(tiles["your army on a cleared site"]);
    const selectedId = selected === "army" ? ARMY : selected === "realm" ? REALM : null;
    // The map's own selection for the row: the army on its own tile, the realm, or nothing.
    useUIStore.setState({
      mapSelection:
        selected === "army"
          ? { kind: "army", entityId: ARMY, tile: "own" }
          : selected === "realm"
            ? { kind: "structure", entityId: REALM }
            : null,
    });
    useUIStore.setState((state) => ({
      entityActions: {
        ...state.entityActions,
        selectedEntityId: selectedId,
        actionPaths:
          selected === "army"
            ? new Map([
                order(tiles["bare ground in reach"], ActionType.Explore),
                order(tiles["enemy army"], ActionType.Attack),
                order(tiles["your army beside"], ActionType.Help),
                order(tiles["your realm beside"], ActionType.Help),
              ])
            : new Map(),
      },
    }));
    // The planner's reason for the army out of reach, as it records one for a transfer it can't give.
    if (selected === "army")
      (map.scene as unknown as { orderRefusals: Map<string, unknown> }).orderRefusals.set(
        ActionPaths.posKey(tiles["your army far"], true),
        { reason: "too-far" },
      );
    Object.assign(map.scene, {
      worldSpatialProjection: {
        getArmy: (id: number) => (armies.has(id) ? { hexCoords: contract(armies.get(id)!) } : undefined),
        getStructuresAtHex: (at: { col: number; row: number }) =>
          at.col === cleared.col && at.row === cleared.row ? [{ clearedSite: true }] : [],
      },
      getHexagonEntity: (hex: { col: number; row: number }) => entities.get(key(hex)) ?? {},
      getOwnArmyOrderedTo: () => undefined,
      usableSiteAt: () => null,
      // The realm's spire, whose army is the one standing on it.
      isArmysSpire: (_army: number, hex: { col: number; row: number }) =>
        key(hex) === key(tiles["your army on its spire"]),
      isStandingExpeditionSite: () => false,
      logInteractionDebug: () => {},
      getInteractionDebugSnapshot: () => ({}),
      onArmySelection: (id: number) => did.push(`select army ${id}`),
      onStructureSelection: (id: number) => did.push(`select realm ${id}`),
      clearEntitySelection: () => did.push("let go"),
      onArmyAttack: () => did.push("attack card"),
      interactionAdapter: {
        selectHex: () => did.push("tile selected"),
        enterStructure: ({ structureId, spectator }: { structureId: number; spectator: boolean }) =>
          did.push(`${spectator ? "visit" : "enter"} realm ${structureId}`),
        openOwnedStructureContextMenu: () => did.push("realm menu"),
      },
      state: {
        ...(map.scene as unknown as { state: object }).state,
        selectOnMap: (intent: { kind: string; tile?: unknown }) =>
          did.push(intent.kind === "army" ? "army kept, tile card" : `select ${intent.kind}`),
      },
    });
    const scene = map.scene as unknown as {
      onHexagonClick: (hex: { col: number; row: number }) => void;
      onHexagonDoubleClick: (hex: { col: number; row: number }) => void;
      onHexagonRightClick: (event: MouseEvent, hex: { col: number; row: number }) => void;
    };
    /** What the gesture did, in the player's words: what it selected or opened, or the order it sent or pinned. */
    const outcome = () => {
      const drawn = drawnSurface();
      return [
        ...did,
        ...(drawn ? [`${drawn.id}: ${drawn.host.textContent}`] : []),
        ...map.sent.map(() => "its order runs"),
        ...map.pinned.filter(Boolean).map(() => "order pinned"),
        ...map.facts.map(() => "its facts"),
      ].join(", ");
    };
    return { scene, outcome };
  };

  beforeEach(() => {
    useAccountStore.setState({ account: { address: "0x111" } as never });
    vi.spyOn(configManager, "isCommandEnabled").mockReturnValue(true);
  });
  afterEach(() => usePopoverStore.getState().close());

  /** A finger held on the tile: the touch recognizer sends it as a right-click from a touch. */
  const hold = () => Object.assign(new MouseEvent("contextmenu", { button: 2 }), { pointerType: "touch" });

  const play = (layout: "desktop" | "phone", gesture: "click" | "right-click" | "hold", frontier: boolean) => {
    const rows = {} as Record<Selected, Record<Clicked, string>>;
    for (const selected of ["nothing", "army", "realm"] as const) {
      rows[selected] = {} as Record<Clicked, string>;
      for (const clicked of Object.keys(tiles) as Clicked[]) {
        screen(layout === "desktop");
        usePopoverStore.getState().close();
        const { scene, outcome } = mapWith(selected, frontier);
        if (gesture === "click") scene.onHexagonClick(tiles[clicked]);
        else if (gesture === "hold") scene.onHexagonRightClick(hold(), tiles[clicked]);
        else scene.onHexagonRightClick(new MouseEvent("contextmenu", { button: 2 }), tiles[clicked]);
        rows[selected][clicked] = outcome();
      }
    }
    return rows;
  };

  /** A click on what is not the player's own lets go of the army or realm, as a click with nothing selected. */
  const letsGo = "tile selected, let go";
  /** A click or tap on the player's own army or realm selects it, whatever order the selection has there. */
  const selects = {
    "your army beside": "tile selected, select army 8",
    "your army far": "tile selected, select army 10",
    "your realm beside": "tile selected, select realm 9",
    "your army on its spire": "tile selected, select army 11",
    "your army on a cleared site": "tile selected, select army 12",
  };
  const elsewhere = { "enemy army": letsGo, "bare ground in reach": letsGo, "bare ground far": letsGo };

  it.each([
    ["Frontier", true],
    ["Blitz", false],
  ])("%s desktop, a click: selects the player's own, keeps the army on a target, lets go elsewhere", (_, frontier) => {
    expect(play("desktop", "click", frontier)).toEqual({
      nothing: { ...selects, ...elsewhere },
      army: { ...selects, ...elsewhere, "enemy army": "attack card" },
      realm: { ...selects, ...elsewhere },
    });
  });

  it("Frontier desktop, a right-click: the army's order or why it has none, everywhere", () => {
    const none = {
      "your army beside": "",
      "your army far": "",
      "your army on its spire": "",
      "your army on a cleared site": "",
      "enemy army": "",
      "bare ground in reach": "",
      "bare ground far": "",
    };
    expect(play("desktop", "right-click", true)).toEqual({
      nothing: { ...none, "your realm beside": "realm menu" },
      army: {
        "your army beside": "its order runs",
        "your army far": "order-preview: Too far: move closerTransfer troops",
        "your army on its spire": "order-preview: Too far: move closerTransfer troops",
        "your army on a cleared site": "order-preview: Too far: move closerTransfer troops",
        "your realm beside": "its order runs",
        "enemy army": "its order runs",
        "bare ground in reach": "its order runs",
        "bare ground far": "order-preview: Too far: move closerExplore",
      },
      realm: { ...none, "your realm beside": "realm menu" },
    });
  });

  // Reviewer, 27 October 2026: a friendly army or realm the army can transfer to must still be selected by a tap.
  it("Frontier phone, a tap: selects the player's own even beside the army, and keeps the phone's order rules elsewhere", () => {
    expect(play("phone", "click", true)).toEqual({
      nothing: { ...selects, ...elsewhere },
      army: {
        ...selects,
        "enemy army": "attack card",
        "bare ground in reach": "order pinned",
        "bare ground far": letsGo,
      },
      realm: { ...selects, ...elsewhere },
    });
  });

  /**
   * A double tap, as the touch recognizer sends it: two taps, then the double tap, as a mouse sends two clicks and a
   * double-click (owner, 28 October 2026: "double tapping the realm on mobile should bring me to the realm view !").
   */
  const doubleTap = (
    layout: "desktop" | "phone",
    selected: Selected,
    frontier: boolean,
    tile: { col: number; row: number },
  ) => {
    screen(layout === "desktop");
    usePopoverStore.getState().close();
    const { scene, outcome } = mapWith(selected, frontier);
    scene.onHexagonClick(tile);
    scene.onHexagonClick(tile);
    scene.onHexagonDoubleClick(tile);
    return outcome();
  };

  it.each([
    ["Frontier", true],
    ["Blitz", false],
  ])(
    "%s, a double tap or double-click on a realm: the taps select as ever, then the realm's view opens",
    (_, frontier) => {
      for (const layout of ["phone", "desktop"] as const) {
        // The player's realm: selected by each tap, then its own realm view.
        expect(doubleTap(layout, "nothing", frontier, tiles["your realm beside"])).toBe(
          "tile selected, select realm 9, tile selected, select realm 9, enter realm 9",
        );
        // Another player's realm: each tap lets go, as a tap on another's thing does, then its read-only visit.
        expect(doubleTap(layout, "nothing", frontier, OTHER_REALM_TILE)).toBe(
          "tile selected, let go, tile selected, let go, visit realm 98",
        );
      }
    },
  );

  // Owner, 27 October 2026: "Yes double tapping to explore on mobile". Its two taps pin, then send; the double tap
  // finds no structure there and adds nothing.
  it("keeps a phone's double tap on bare ground in reach the explore it was: pinned, then sent once", () => {
    expect(doubleTap("phone", "army", true, tiles["bare ground in reach"])).toBe("its order runs, order pinned");
  });

  it("sends no order from a double tap on a realm with the army selected, on a phone or a desktop", () => {
    for (const layout of ["phone", "desktop"] as const)
      for (const tile of [tiles["your realm beside"], OTHER_REALM_TILE]) {
        const done = doubleTap(layout, "army", true, tile);
        expect(done, `${layout} ${JSON.stringify(tile)}`).not.toMatch(/its order runs|order pinned/);
        expect(done).toMatch(/(enter|visit) realm (9|98)/);
      }
  });

  it("Frontier phone, a hold: the transfer to the player's own beside the army, else the tile's facts", () => {
    const facts = Object.fromEntries(Object.keys(tiles).map((tile) => [tile, "its facts"])) as Record<Clicked, string>;
    expect(play("phone", "hold", true)).toEqual({
      nothing: facts,
      army: { ...facts, "your army beside": "its order runs", "your realm beside": "its order runs" },
      realm: facts,
    });
  });
});
