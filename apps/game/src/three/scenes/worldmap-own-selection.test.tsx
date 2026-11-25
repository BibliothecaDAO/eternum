import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/can-issue-orders", async (original) => ({
  ...(await original<typeof import("@/utils/can-issue-orders")>()),
  canIssueOrders: () => true,
  refusedBeforePlay: () => false,
}));

const { ActionPaths, ActionType, Position } = await import("@bibliothecadao/eternum");
const { useAccountStore } = await import("@/hooks/store/use-account-store");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { default: WorldmapScene } = await import("./worldmap");
const { ownSelectionOn } = await import("./worldmap-own-selection");

const VIEWER = 0x111n;
const RIVAL = 0x999n;
const ARMY = 7;
const ARMY_HEX = { col: 4, row: 5 };
const TARGET = { col: 5, row: 5 };
const isViewer = (owner: bigint | string | null | undefined) => owner === VIEWER;

describe("what the player owns on a tile, the thing a click there selects", () => {
  it.each([
    ["their own army", { army: { id: 9, owner: VIEWER }, ownSupplyPost: null }, { kind: "army", id: 9 }],
    ["their own realm", { structure: { id: 21, owner: VIEWER }, ownSupplyPost: null }, { kind: "structure", id: 21 }],
    [
      "their own supply post",
      { structure: { id: 30, owner: RIVAL }, ownSupplyPost: 30 },
      { kind: "supply-post", id: 30 },
    ],
    [
      "their own army standing on their post",
      { army: { id: 9, owner: VIEWER }, ownSupplyPost: 30 },
      { kind: "army", id: 9 },
    ],
    ["a rival's army", { army: { id: 8, owner: RIVAL }, ownSupplyPost: null }, null],
    ["a rival's structure or a site", { structure: { id: 40, owner: RIVAL }, ownSupplyPost: null }, null],
    ["bare ground", { ownSupplyPost: null }, null],
  ] as const)("%s", (_, tile, own) => {
    expect(ownSelectionOn(tile, isViewer)).toEqual(own);
  });
});

const screen = (desktop: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: desktop && query.includes("min-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

const contract = (hex: { col: number; row: number }) => {
  const at = Position.fromNormalized({ x: hex.col, y: hex.row }).getContract();
  return { col: at.x, row: at.y };
};

type Tile = {
  army?: { id: number; owner: bigint };
  structure?: { id: number; owner: bigint };
  ownSupplyPost?: number;
  siteCard?: boolean;
};

const mapWithArmySelected = (target: Tile) => {
  const selections: unknown[] = [];
  const armies: unknown[] = [];
  const attacks: unknown[] = [];
  const cleared: number[] = [];
  const tiles = new Map<string, Tile>([
    [ActionPaths.posKey(ARMY_HEX), { army: { id: ARMY, owner: VIEWER } }],
    [ActionPaths.posKey(TARGET), target],
  ]);
  const at = (hex: { col: number; row: number }) => tiles.get(ActionPaths.posKey(hex)) ?? {};
  const scene = Object.assign(Object.create(WorldmapScene.prototype), {
    orderRefusals: new Map(),
    game: { store: { get: () => undefined } },
    worldSpatialProjection: { getArmy: () => ({}), getStructuresAtHex: () => [] },
    pointerOrderTip: { take: () => {}, refresh: () => {} },
    interactionAdapter: { selectHex: () => {} },
    state: {
      selectOnMap: (intent: unknown) => selections.push(intent),
      updateEntityActionHoveredHex: () => {},
    },
    isFrontierHud: () => true,
    queuesNextOrder: () => false,
    getHexagonEntity: (hex: { col: number; row: number }) => ({ army: at(hex).army, structure: at(hex).structure }),
    ownSupplyPostAt: (hex: { col: number; row: number }) => at(hex).ownSupplyPost ?? null,
    hasSiteCardAt: (hex: { col: number; row: number }) => at(hex).siteCard === true,
    isArmysSpire: () => false,
    isStandingExpeditionSite: () => false,
    getOwnArmyOrderedTo: () => undefined,
    logInteractionDebug: () => {},
    getInteractionDebugSnapshot: () => ({}),
    onArmySelection: (entityId: number) => armies.push(entityId),
    onArmyAttack: (_path: unknown, entityId: number) => attacks.push(entityId),
    onStructureSelection: (entityId: number) => selections.push({ kind: "structure", entityId }),
    clearEntitySelection: () => cleared.push(1),
  }) as { onHexagonClick: (hex: { col: number; row: number }) => void };
  scene.onHexagonClick(TARGET);
  return { selections, armies, attacks, cleared };
};

const ARMY_KEPT_FOR_TARGET = { kind: "army", entityId: ARMY, tile: contract(TARGET) };

describe.each([
  ["a desktop", true],
  ["a phone", false],
])("on %s, with an army selected, a click on", (_, desktop) => {
  beforeEach(() => {
    screen(desktop);
    useAccountStore.setState({ account: { address: `0x${VIEWER.toString(16)}` } } as never);
    useUIStore.setState((state) => ({
      entityActions: { ...state.entityActions, selectedEntityId: ARMY, actionPaths: new Map(), hoveredHex: null },
    }));
  });
  afterEach(() => {
    useAccountStore.setState({ account: null });
    vi.unstubAllGlobals();
  });

  it("the player's own supply post selects the post and opens its panel, letting the army go", () => {
    const { selections, armies } = mapWithArmySelected({
      structure: { id: 30, owner: RIVAL },
      ownSupplyPost: 30,
      siteCard: true,
    });
    expect([selections, armies]).toEqual([[{ kind: "structure", entityId: 30 }], []]);
  });

  it("the player's own realm selects the realm", () => {
    const { selections, armies } = mapWithArmySelected({ structure: { id: 21, owner: VIEWER } });
    expect([selections, armies]).toEqual([[{ kind: "structure", entityId: 21 }], []]);
  });

  it("another of the player's armies selects that army", () => {
    const { selections, armies } = mapWithArmySelected({ army: { id: 9, owner: VIEWER } });
    expect([selections, armies]).toEqual([[], [9]]);
  });

  it("a Deep site keeps the army and opens the site's card for it", () => {
    const { selections, armies } = mapWithArmySelected({ structure: { id: 40, owner: RIVAL }, siteCard: true });
    expect([selections, armies]).toEqual([[ARMY_KEPT_FOR_TARGET], []]);
  });
});

describe("on a desktop, with an army selected, a click on", () => {
  beforeEach(() => {
    screen(true);
    useAccountStore.setState({ account: { address: `0x${VIEWER.toString(16)}` } } as never);
    useUIStore.setState((state) => ({
      entityActions: { ...state.entityActions, selectedEntityId: ARMY, actionPaths: new Map(), hoveredHex: null },
    }));
  });
  afterEach(() => {
    useAccountStore.setState({ account: null });
    vi.unstubAllGlobals();
  });

  it("a rival's army the army can attack is that army's attack", () => {
    useUIStore.setState((state) => ({
      entityActions: {
        ...state.entityActions,
        actionPaths: new Map([
          [
            ActionPaths.posKey(TARGET, true),
            [
              { hex: ARMY_HEX, actionType: ActionType.Move },
              { hex: TARGET, actionType: ActionType.Attack, staminaCost: 20 },
            ],
          ],
        ]),
      },
    }));
    const { selections, armies, attacks } = mapWithArmySelected({ army: { id: 8, owner: RIVAL } });
    expect([selections, armies, attacks]).toEqual([[], [], [ARMY]]);
  });

  it("a rival's supply post keeps the army and opens that tile's card for it", () => {
    const { selections, armies } = mapWithArmySelected({ structure: { id: 31, owner: RIVAL }, siteCard: true });
    expect([selections, armies]).toEqual([[ARMY_KEPT_FOR_TARGET], []]);
  });

  it("bare ground lets the army go", () => {
    const { selections, armies, cleared } = mapWithArmySelected({});
    expect([selections, armies, cleared]).toEqual([[], [], [1]]);
  });
});
