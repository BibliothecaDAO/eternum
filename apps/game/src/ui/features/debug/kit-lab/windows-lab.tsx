import { GameProvider } from "@/hooks/context/game-context";
import { installActiveGameClient } from "@/sync/active-game-client";
import { ErrorBoundary } from "@/ui/shared/error-boundary";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useDocumentClass } from "@/hooks/use-document-class";
import { SurfaceHost } from "@/ui/design-system/molecules/popover";
import { Tooltip } from "@/ui/design-system/molecules/tooltip";
import { CraftRelicPopup } from "@/ui/features/economy/resources/craft-relic-popup";
import { RelicActivationPopup } from "@/ui/features/economy/resources/relic-activation-popup";
import { MarketModal } from "@/ui/features/economy/trading/market-modal";
import { TransferAutomationAdvancedModal } from "@/ui/features/economy/transfers/transfer-automation-modal";
import { openTransfer } from "@/ui/features/economy/transfers/transfer-window";
import { RealmNumberPicker } from "@/ui/features/game-entry/realm-number-picker";
import { RelicActivationSelector } from "@/ui/features/relics/components/relic-activation-selector";
import { ProductionModal } from "@/ui/features/settlement/production/production-modal-content";
import { ProductionPopupShell } from "@/ui/features/settlement/production/production-popup-shell";
import { RealmAutomationPanel } from "@/ui/features/settlement/production/realm-automation-panel";
import { StructureEditPopup } from "@/ui/features/world/components/structure-edit-popup";
import { ConstructionModal } from "@/ui/features/world/containers/construction-modal";
import { SettingsPanel } from "@/ui/modules/settings/settings";
import { createGameViews, type GameClient } from "@bibliothecadao/eternum";
import type { GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { EntityType, RelicRecipientType, ResourcesIds, StructureType, TileOccupier } from "@bibliothecadao/types";
import { type ReactNode, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { installFixtureGame, PLAYER } from "./fixture-game";

/**
 * The lab's game client: the fixture's store, the game's own views over it, and no way to
 * send anything: a press that would act on the chain does nothing here.
 */
/** Every call to the chain a window can make, refused: the lab sends nothing. */
const SENDS_NOTHING = new Proxy({}, { get: () => () => Promise.reject(new Error("The lab sends nothing")) });

const installLabGameClient = (store: NativeFactStore) => {
  const client = {
    setup: { store, systemCalls: SENDS_NOTHING },
    connect() {},
    disconnect() {},
    dispose() {},
    visit() {},
    actions: SENDS_NOTHING,
  } as unknown as GameClient;
  Object.assign(client, { views: createGameViews(client, BigInt(PLAYER), () => null) });
  installActiveGameClient(client);
};

/** The fixture's realm, which every window opens on. */
const REALM = 7;

/**
 * What a Blitz realm with coal, wood, copper, gold, dragonhide and paladin buildings automates, each with the inputs its
 * Blitz recipe burns (the fixture holds no recipe for them; one unit of each input a cycle, for one unit out).
 */
const AUTOMATED_INPUTS: Partial<Record<ResourcesIds, ResourcesIds[]>> = {
  [ResourcesIds.Coal]: [ResourcesIds.Wheat, ResourcesIds.Wood, ResourcesIds.Copper],
  [ResourcesIds.Wood]: [ResourcesIds.Wheat, ResourcesIds.Coal, ResourcesIds.Copper],
  [ResourcesIds.Copper]: [ResourcesIds.Wheat, ResourcesIds.Wood, ResourcesIds.Coal],
  [ResourcesIds.Gold]: [ResourcesIds.Wheat, ResourcesIds.Coal, ResourcesIds.Copper],
  [ResourcesIds.Dragonhide]: [ResourcesIds.Wheat, ResourcesIds.Coal, ResourcesIds.Gold],
  [ResourcesIds.Paladin]: [ResourcesIds.Wheat, ResourcesIds.Copper],
  [ResourcesIds.PaladinT2]: [
    ResourcesIds.Wheat,
    ResourcesIds.Paladin,
    ResourcesIds.Copper,
    ResourcesIds.Gold,
    ResourcesIds.Essence,
  ],
  [ResourcesIds.PaladinT3]: [
    ResourcesIds.Wheat,
    ResourcesIds.PaladinT2,
    ResourcesIds.Gold,
    ResourcesIds.Dragonhide,
    ResourcesIds.Essence,
  ],
};
const AUTOMATED = Object.keys(AUTOMATED_INPUTS).map(Number) as ResourcesIds[];
const automatedRecipes = () =>
  Object.entries(AUTOMATED_INPUTS).map(([resource, inputs]) => ({
    model: "ProductionRecipe",
    key: `0xa${resource}`,
    value: {
      game_id: 1,
      resource_type: Number(resource),
      simple_output: 0n,
      simple_inputs: [],
      complex_output: 1_000_000_000n,
      complex_inputs: inputs!.map((input) => ({ resource_type: input, amount: 1_000_000_000n })),
    },
  }));

/** Opens a window on the popover host, as the game's buttons open it. */
const openWindow = (id: string, content: ReactNode) => usePopoverStore.getState().openSurface({ id, content });
const close = () => usePopoverStore.getState().close();

/** Opens a window that lives on the popover host, the way its button opens it in the game. */
const Opened = ({ open }: { open: () => void }) => {
  const [first] = useState(() => open);
  useEffect(first, [first]);
  return null;
};

/**
 * Each window of the HUD's windows and modals, by the name in its address: the real component, as its button opens it.
 * Windows that hang from the popover host are opened through it; the rest are mounted where the game mounts them.
 */
const SURFACES: Record<string, { name: string; draw: () => ReactNode }> = {
  build: { name: "Build", draw: () => <ConstructionModal structureEntityId={REALM} /> },
  production: { name: "Production", draw: () => <ProductionModal preSelectedRealmId={REALM} /> },
  // The Production window's Automation tab for a realm that makes what the owner's Blitz realm makes (the fixture
  // realm has no resource building, so the window itself has nothing to automate).
  automation: {
    name: "Automation",
    draw: () => (
      <ProductionPopupShell>
        <RealmAutomationPanel realmEntityId={String(REALM)} realmName="Stolsli" producedResources={AUTOMATED} />
      </ProductionPopupShell>
    ),
  },
  transfer: {
    name: "Transfer",
    draw: () => <Opened open={() => openTransfer({ sourceId: REALM, destinationIds: [] })} />,
  },
  // A Blitz player holding every kind a transfer can use: each end's tabs as they stand when the kinds pile up.
  "transfer-holdings": {
    name: "Transfer, many holdings",
    draw: () => <Opened open={() => openTransfer({ sourceId: REALM, destinationIds: [] })} />,
  },
  "structure-edit": {
    name: "Edit structure",
    draw: () => (
      <StructureEditPopup
        currentName="Egonal"
        originalName="Egonal"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    ),
  },
  "transfer-automation": { name: "Transfer automation", draw: () => <TransferAutomationAdvancedModal /> },
  "craft-relic": {
    name: "Craft relic",
    draw: () => (
      <Opened open={() => openWindow("craft-relic", <CraftRelicPopup structureId={REALM} onClose={close} />)} />
    ),
  },
  "activate-relic": {
    name: "Activate relic",
    draw: () => (
      <Opened
        open={() =>
          openWindow(
            "activate-relic",
            <RelicActivationPopup
              entityId={REALM}
              entityOwnerId={REALM}
              recipientType={RelicRecipientType.Structure}
              relicId={ResourcesIds.ProductionRelic1}
              relicBalance={2}
              onClose={close}
            />,
          )
        }
      />
    ),
  },
  "relic-target": {
    name: "Relic target",
    draw: () => (
      <Opened
        open={() =>
          openWindow(
            "relic-target",
            <RelicActivationSelector
              resourceId={ResourcesIds.ProductionRelic1}
              holders={[
                {
                  entityId: REALM,
                  held: 2,
                  recipientType: RelicRecipientType.Structure,
                  entityType: EntityType.STRUCTURE,
                },
              ]}
              onClose={close}
            />,
          )
        }
      />
    ),
  },
  market: { name: "Market", draw: () => <Opened open={() => openWindow("market", <MarketModal />)} /> },
  // The header's Settings, at the width and in the look of the popover it opens in.
  settings: {
    name: "Settings",
    draw: () => (
      <div data-lab-settings className="ui ui-popover w-hud-settings rounded-xl p-4">
        <SettingsPanel />
      </div>
    ),
  },
  "realm-number": {
    name: "Realm number",
    draw: () => <RealmNumberPicker value="1234" onChange={() => undefined} disabled={false} />,
  },
};

/**
 * Dev only: the windows and modals of the HUD (areas B and C of the style-sheet migration), each the real component on
 * the lab's fixture game, at /lab/kit/windows/<surface>, so a window reads the same before and after it moves onto the
 * sheet at 1920×1080.
 */
export const WindowsLab = () => {
  useDocumentClass("classic-hud");
  const { surface = "build" } = useParams();
  const [store] = useState(() => {
    const fixture = installFixtureGame();
    // What the windows read that the fixture leaves out: the research a relic costs, each building's rule, and the
    // player's points, which Settings' card ranks.
    fixture.applyFacts([
      { model: "ArtificerCost", key: "0xa", value: { game_id: 1, research: 500n } },
      { model: "PlayerPoints", key: "0xc", value: { game_id: 1, address: BigInt(PLAYER), points: 35_000_000n } },
      ...automatedRecipes(),
      ...preset.buildings.map(({ category, rule }) => ({
        model: "BuildingRule",
        key: `0xb${category}`,
        value: {
          ...rule,
          game_id: 1,
          category,
          simple_cost: rule.simple_cost.map((cost) => ({ ...cost, amount: BigInt(cost.amount) })),
          complex_cost: rule.complex_cost.map((cost) => ({ ...cost, amount: BigInt(cost.amount) })),
        },
      })),
    ] as never);
    if (surface === "transfer-holdings") fixture.applyFacts(holdingsOfEveryKind() as never);
    installLabGameClient(fixture);
    return fixture;
  });
  const shown = SURFACES[surface];
  return (
    <GameProvider
      value={{ store, systemCalls: SENDS_NOTHING } as unknown as GameClientSetup}
      account={{ address: PLAYER } as never}
    >
      <div className="relative min-h-screen bg-[#0b1418]">
        <nav data-lab-chrome className="flex flex-wrap gap-3 p-3 text-sm text-white/70">
          {Object.entries(SURFACES).map(([key, { name }]) => (
            <Link
              key={key}
              to={`/lab/kit/windows/${key}`}
              data-lab-surface={key}
              className={key === surface ? "text-white" : undefined}
            >
              {name}
            </Link>
          ))}
        </nav>
        <div data-lab-stage className="flex justify-center p-6">
          <ErrorBoundary key={surface}>
            {shown ? shown.draw() : <p className="text-white">No window named {surface}.</p>}
          </ErrorBoundary>
        </div>
        <ErrorBoundary key={`host-${surface}`}>
          <SurfaceHost />
        </ErrorBoundary>
        <Tooltip />
      </div>
    </GameProvider>
  );
};

/** What stands on a holding's tile, by its kind. */
const OCCUPIER: Partial<Record<StructureType, TileOccupier>> = {
  [StructureType.Realm]: TileOccupier.RealmRegularLevel1,
  [StructureType.Village]: TileOccupier.Village,
  [StructureType.Mine]: TileOccupier.Mine,
  [StructureType.Hyperstructure]: TileOccupier.Hyperstructure,
  [StructureType.Camp]: TileOccupier.Camp,
};

/** One more of the player's holdings, on its own tile: its kind, and for a rift which kind of mine it is. */
const holding = (entityId: number, category: StructureType, mineKind = 0) => [
  {
    model: "TileOccupancy",
    key: `0x7${entityId.toString(16)}0`,
    value: {
      game_id: 1,
      alt: false,
      col: (entityId % 6) * 4,
      row: Math.floor(entityId / 6) * 4,
      entity_id: entityId,
      category: OCCUPIER[category],
      is_structure: true,
    },
  },
  structureRow(entityId, category, mineKind),
];

const structureRow = (entityId: number, category: StructureType, mineKind: number) => ({
  model: "Structure",
  key: `0x${entityId.toString(16)}`,
  value: {
    game_id: 1,
    entity_id: entityId,
    owner: PLAYER,
    base: {
      category,
      level: 0,
      created_at: "0x1",
      troop_max_guard_count: 1,
      troop_max_explorer_count: category === StructureType.Realm ? 1 : 0,
      starting_troops_granted: false,
    },
    resources_packed: "0x0",
    metadata: {
      realm_id: category === StructureType.Realm ? entityId : 0,
      village_realm: 0,
      mine_kind: mineKind,
      deepest_depth: 0,
      has_wonder: false,
      order: 0,
    },
  },
});

/**
 * The owner's Blitz holdings of 20 October beside the fixture's realm: five more realms, four villages, three rifts,
 * and a Hyperstructure and a camp taken from The Vanguard, so both ends list five kinds, each on its own tile a few
 * hexes from the realms (which the fixture's rules place by the origin).
 */
const holdingsOfEveryKind = () => [
  ...[8, 9, 10, 11, 12].flatMap((id) => holding(id, StructureType.Realm)),
  ...[13, 14, 15, 16].flatMap((id) => holding(id, StructureType.Village)),
  ...[17, 18, 19].flatMap((id) => holding(id, StructureType.Mine, 1)),
  ...holding(20, StructureType.Hyperstructure),
  ...holding(21, StructureType.Camp),
];
