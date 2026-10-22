// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ActionPath } from "@bibliothecadao/eternum";
import { PerspectiveCamera } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/can-issue-orders", async (original) => ({
  ...(await original<typeof import("@/utils/can-issue-orders")>()),
  canIssueOrders: () => true,
  refusedBeforePlay: () => false,
}));

const { ActionPaths, ActionType, configManager, setBlockTimestampSource } = await import("@bibliothecadao/eternum");
const { useAccountStore } = await import("@/hooks/store/use-account-store");
const { usePopoverStore } = await import("@/hooks/store/use-popover-store");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { default: WorldmapScene } = await import("./worldmap");

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
    answerTapWithSelectedArmyOrder: (hex: { col: number; row: number }) => boolean;
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

    expect(scene.answerTapWithSelectedArmyOrder(BESIDE)).toBe(true);

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

  expect(scene.answerTapWithSelectedArmyOrder(BESIDE)).toBe(true);

  expect(pinned).toEqual([BESIDE]);
  expect(facts).toEqual([BESIDE]);
  expect(usePopoverStore.getState().surface).toBeNull();
  expect(sent).toEqual([]);

  // Owner, 22 October 2026 (mobile direction A): the same tile again sends the pinned order.
  expect(scene.answerTapWithSelectedArmyOrder(BESIDE)).toBe(true);
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

  expect(scene.answerTapWithSelectedArmyOrder(BESIDE)).toBe(true);
  expect([facts, pinned, sent]).toEqual([[BESIDE], [], []]);
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
    scene.answerTapWithSelectedArmyOrder(BESIDE);
    const drawn = drawnSurface()!;

    change(scene);

    expect(usePopoverStore.getState().surface).toBeNull();
    act(() => verbOf(drawn.host, "Explore").click());
    expect(sent).toEqual([]);
  });

  it("sends nothing when the order's cost changed before the map heard of it", () => {
    const { scene, sent } = worldMap(true);
    scene.answerTapWithSelectedArmyOrder(BESIDE);
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
    scene.answerTapWithSelectedArmyOrder(BESIDE);
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
