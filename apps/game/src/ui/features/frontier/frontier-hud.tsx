import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import { StaminaReading } from "./hud/army-token";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders, isWatching } from "@/utils/can-issue-orders";
import { useRealmVisit } from "@/sync/active-game-client";
import { dropNextOrder } from "@/three/scenes/worldmap-next-order";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { SETTINGS } from "@/ui/design-system/kit/words";
import { useGameChat } from "@/ui/features/world/containers/hud-chat-window";
import { IdentityChip } from "@/ui/features/world/containers/top-header/identity-chip";
import { HudSheet } from "@/ui/design-system/kit/hud-elements";
import { useUnreadImportantCount } from "@/ui/features/event-feed/quick-feed";
import { SettingsPanel } from "@/ui/modules/settings/settings";
import { configManager, resolveUseSimpleCost } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType, catalogAspectId, formatRate, StructureType } from "@bibliothecadao/types";
import { useLayout } from "@/shell/frame/layout";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { type ComponentProps, type ComponentType, type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RealmVisitFoot, useRealmVisitNavigation, useVisitedRealm } from "./board/realm-visit";
import { FrontierSeason, useSeasonRank } from "./board/season-board";
import { useSpectatorWatch } from "./board/spectator-watch";
import { useExpeditionRules, useFrontierRealm, useGoToFrontierPlace } from "./frontier-home";
import { ArmyLostSheet } from "./army/army-lost";
import { useArmyPanelOpens, usePickArmy } from "./army/army-opens";
import { FrontierArmy } from "./army/frontier-army";
import { FrontierOathPick } from "./army/oath-pick";
import { useSelectionCard } from "./frontier-selection-sheet";
import { useRealmStores } from "./realm-stores";
import { FrontierSurfaces } from "./frontier-surfaces";
import { useArmyRevealYield } from "./frontier-reveal-yield";
import { type ArmyOrder, useArmyOrder } from "./hud/army-order";
import { ArmyDock } from "./hud/army-dock";
import { useChatKey } from "./hud/chat-key";
import { FrontierDesktop, FrontierPlaces } from "./hud/frontier-desktop";
import { FrontierFeed } from "./hud/frontier-feed";
import { useResearchTree } from "./research/research-facts";
import { canResearchNow } from "./research/research-tree";
import { ChatPage } from "./hud/chat-page";
import { type DockArmy, useDockArmies } from "./hud/dock-armies";
import { FrontierNav, type HudSurface } from "./hud/frontier-nav";
import { useMapLayers } from "./hud/map-layers";
import { SurfaceDeepSwitch } from "./hud/surface-deep-switch";
import { useOnePanel, useOrderSettledReturnsToTheArmy } from "./hud/one-panel";
import { FrontierDayClock } from "./hud/day-pill";
import { DayEndBlock, DayEndNotice, useDayEnd } from "./day-end/day-end";
import { useFirstBuild, useMarkFirstBuild } from "./build/first-build";
import { FrontierStrip, useStoreReadings } from "./hud/frontier-strip";
import { RealmPanel, type RealmBuildingItem } from "./hud/realm-panel";
import { HudBands } from "./hud/hud-bands";
import { MenuPage } from "./hud/menu-page";
import { useHowToPlay } from "@/ui/modules/how-to-play";
import { FragmentsPurse, PurseRow } from "./value/lords-purse";
import { useFragmentsHeld } from "./value/fragments";
import { ShopSheet, useReturnToShop } from "./shop/shop-sheet";
import { homeKind } from "@/ui/design-system/home-icons";
import { OfflineNotice } from "./hud/offline-notice";
import { SceneFailureNotice } from "./hud/scene-failure-notice";
import { NextOrderBar, OrderBar } from "./hud/order-bar";
import { PickedArmy } from "./hud/picked-army";
import { ArmyRefill, sellsStamina } from "./army/army-refill";
import { useArmySpireStatus } from "./spire-card";
import { DailyQuest } from "./day/daily-quest";
import { OpeningProvider, usePartShown } from "./opening/opening-context";
import { OpeningLineView } from "./opening/opening-line-view";
import { OpeningOffer } from "./opening/opening-offer";
import { useOpening } from "./opening/use-opening";
import { useSiteAlertOffer } from "./opening/use-site-alert-offer";
import { FrontierToday } from "./log/frontier-today";
import { CARD_STORE_KINDS, type CardStore, FrontierStoreCard, isCardStore } from "./production/frontier-store-card";
import { FrontierResearch } from "./research/frontier-research";

import { BuildingsInFlight } from "./build/build-sheet";
import { readBuildOptions } from "./build/build-options";
import { buildingIcon, buildingName } from "./build/building-names";
import { FRONTIER_STORES, madeStore } from "./stores";
import { DayDone } from "./rollover/day-done";

import { useDocumentClass } from "@/hooks/use-document-class";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

type FrontierHudProps = {
  rules: ExpeditionRules;
  seasonOver: ComponentType<{ withdraw?: ReactNode }>;
};

/**
 * Frontier's HUD, one set of parts in two compositions (the desktop's shared regions, a phone's bands): the realm and
 * its stores, a nav page or the map, the action bar while an army is selected, the armies and the places.
 * Everything else opens from these as a sheet. Its parts wait on their moment, and a moment's line shows once.
 */
export const FrontierHud = (props: FrontierHudProps) => {
  const realm = useFrontierRealm();
  const visit = useRealmVisit();
  const { opened, line, gotIt, offerDue } = useOpening(props.rules, visit ? null : realm);
  const offer = useSiteAlertOffer(offerDue);
  return (
    <OpeningProvider opened={opened}>
      <FrontierHudBody {...props} opening={{ line, offer, gotIt }} />
    </OpeningProvider>
  );
};

const FrontierHudBody = ({
  rules,
  seasonOver: SeasonOver,
  opening,
}: FrontierHudProps & {
  opening: Pick<ReturnType<typeof useOpening>, "line" | "gotIt"> & { offer: ReturnType<typeof useSiteAlertOffer> };
}) => {
  // Parts shared with the Blitz and Eternum HUD read upright, untracked and in sentence case here (index.css).
  useDocumentClass("frontier-hud");
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const { isMapView } = useQuery();
  const spectating = useUIStore(isWatching);
  const realm = useFrontierRealm();
  // The realm on the board: on a visit (a spectator's watch is one too) the visited realm, whose strip, panel and
  // armies the HUD shows; no order renders for a realm the player does not own.
  const visit = useRealmVisit();
  const visited = useVisitedRealm(visit);
  const shown = visit ? visited : realm;
  // The visit's way in and out lives here, above the two layouts, so switching layout replays no visit.
  useRealmVisitNavigation(realm);
  // A spectator watches their own realm when they have one this season, else the leader; the strip reads it.
  useSpectatorWatch();
  // What the map has selected opens its card; the one panel decides which of it, a surface and a deploy order stands.
  // A tap on the board names the realm the board draws, so its cards read that realm: on a visit, the visited one's.
  // A card's way to Research may name the node it opens on (the castle's own research, a building's gate).
  const [researchPick, setResearchPick] = useState<string | undefined>();
  // The realm's first build: its board lights a plot for it and the build sheet opens on it; a visit marks none.
  useMarkFirstBuild(useFirstBuild(visit ? null : realm));
  const card = useSelectionCard({
    realm: shown,
    onResearch: (node) => {
      setResearchPick(node);
      setSurface("research");
    },
  });
  const desktop = useLayout() === "desktop";
  const { surface, openSurface: setSurface, showsCard } = useOnePanel(card?.key ?? null, !desktop);
  useReturnToShop(() => setSurface("shop"));
  const research = useResearchTree(realm);
  useEffect(() => {
    if (surface !== "research") setResearchPick(undefined);
  }, [surface]);
  // Selecting one of the realm's armies opens its panel; a pick in the dock or Today goes the same way.
  const armyPanel = useArmyPanelOpens(
    visit ? null : realm,
    () => {
      setSurface("army");
    },
    desktop,
  );
  useOrderSettledReturnsToTheArmy(card?.key ?? null, {
    returnTo: armyPanel.returnTo,
    showLoss: () => setSurface("army-lost"),
  });
  const openArmy = armyPanel.pick;
  const pickArmy = usePickArmy();
  // The day's end speaks to a player in their own realm: a visit or a spectator has none. Its army is picked as the
  // dock picks one: a desktop opens the army's panel in Today's place, even for the army already selected; a phone puts
  // Today away and shows the army in the action row, the map first.
  const dayEnd = useDayEnd(rules, visit ? null : realm, {
    onPickArmy: desktop
      ? openArmy
      : (explorerId) => {
          pickArmy(explorerId);
          setSurface(null);
        },
  });
  const seasonRank = useSeasonRank();
  const aspectsOpen = usePartShown("aspects");
  const fragments = useFragmentsChip();
  const layers = useMapLayers(rules, shown, visit ? null : realm);
  // The store card a ring or a plate opened, under the realm card on a desktop and under the strip on a phone.
  const [openStore, setOpenStore] = useState<CardStore | null>(null);
  if (showBlankOverlay) return null;
  const close = () => setSurface(null);
  const own = realm && !visit ? realm : null;
  const storeCards = own
    ? {
        kinds: CARD_STORE_KINDS,
        open: openStore,
        onToggle: (kind: string) => {
          if (isCardStore(kind)) setOpenStore((open) => (open === kind ? null : kind));
        },
        card: openStore && (
          <FrontierStoreCard rules={rules} realm={own} store={openStore} onDone={() => setOpenStore(null)} />
        ),
      }
    : undefined;

  const strip = (
    <>
      <FrontierStrip rules={rules} realm={shown} onOpenDay={() => setSurface("today")} storeCards={storeCards} />
      {storeCards?.open && storeCards.card}
    </>
  );
  const purse = spectating ? (
    <IdentityChip compact />
  ) : (
    own &&
    fragments !== null && (
      <PurseRow>
        <FragmentsPurse fragments={fragments} onOpen={() => setSurface("shop")} />
      </PurseRow>
    )
  );
  const page =
    surface === "research" && realm ? (
      <FrontierResearch key={researchPick} realm={realm} pick={researchPick} onClose={close} />
    ) : surface === "season" ? (
      <FrontierSeason rules={rules} onVisited={close} onClose={close} />
    ) : surface === "feed" ? (
      <FrontierFeed onClose={close} />
    ) : surface === "menu" ? (
      <HudMenu onOpen={setSurface} onClose={close} />
    ) : undefined;
  const showOpening = !(desktop && (surface !== null || showsCard));
  const notices = (
    <>
      {own && <DailyQuest realm={own} layout={desktop ? "desktop" : "phone"} />}
      {showOpening && (opening.line || opening.offer) && (
        <div data-opening-notice className="flex flex-col gap-1.5 empty:hidden">
          {opening.line && (
            <OpeningLineView moment={opening.line.moment} rules={opening.line.rules} onGotIt={opening.gotIt} />
          )}
          {opening.offer && <OpeningOffer offer={opening.offer} />}
        </div>
      )}
      <OfflineNotice />
      <SceneFailureNotice />
      {own && <DayEndNotice dayEnd={dayEnd} onOpen={() => setSurface("today")} />}
    </>
  );
  const action = (
    <>
      {shown && !desktop && isMapView && (
        <ArmyAction rules={rules} realm={shown} onOpenArmy={visit ? undefined : openArmy} />
      )}
      <RealmVisitFoot home={realm} />
    </>
  );
  const realmPanel = shown && (
    <FrontierRealmPanel
      rules={rules}
      realm={shown}
      own={own}
      storeCards={storeCards}
      onSurface={setSurface}
      onResearch={(node) => {
        setResearchPick(node);
        setSurface("research");
      }}
    />
  );
  const dock = (() => {
    if (!shown) return null;
    if (isMapView) return <DockFor realm={shown} onOpenArmy={desktop ? openArmy : pickArmy} />;
    return !desktop && !showsCard && surface === null ? realmPanel : null;
  })();
  const sheets = (
    <>
      <FrontierSurfaces realm={realm} rules={rules} />
      {showsCard && card?.sheet}
      {surface === "army" && realm && !visit && <FrontierArmy realm={realm} onClose={close} />}
      {surface === "army-lost" && <ArmyLostSheet onClose={close} />}
      {surface === "shop" && own && <ShopSheet realm={own} onClose={close} />}
      {surface === "settings" && (
        <HudSheet label={SETTINGS} onClose={close}>
          <SettingsPanel />
        </HudSheet>
      )}
      {surface === "today" && (
        <FrontierToday
          rules={rules}
          realm={realm ?? visited}
          dayEnd={own && <DayEndBlock dayEnd={dayEnd} />}
          own={Boolean(own)}
          onClose={close}
        />
      )}
      {surface !== "season" && <SeasonOver />}
      {realm && <DayDone rules={rules} realm={realm} visiting={Boolean(visit)} />}
      <BuildingsInFlight />
      <FrontierOathPick realm={realm} />
    </>
  );

  const depthSwitch = <SurfaceDeepSwitch layers={layers} onSwitch={close} />;

  return desktop ? (
    <FrontierDesktop
      season={aspectsOpen ? { rank: seasonRank, onOpen: () => setSurface("season") } : undefined}
      clock={<FrontierDayClock rules={rules} onOpenToday={() => setSurface("today")} />}
      depthSwitch={depthSwitch}
      realm={realmPanel}
      armies={dock}
      page={page}
      foot={
        <>
          {notices}
          {action}
        </>
      }
      places={
        !(visit && realm) && (
          <FrontierPlaces
            surface={surface}
            onSurface={setSurface}
            research={realm ? canResearchNow(research?.nodes) : undefined}
          />
        )
      }
    >
      {sheets}
    </FrontierDesktop>
  ) : (
    <FrontierPhoneHud
      rules={rules}
      realm={realm}
      board={shown}
      depthSwitch={depthSwitch}
      visiting={visit !== null}
      surface={surface}
      onSurface={setSurface}
      strip={strip}
      purse={purse}
      page={page}
      notices={notices}
      action={action}
      dock={dock}
    >
      {sheets}
    </FrontierPhoneHud>
  );
};

/**
 * Frontier's HUD on a phone, in its bands, and the one owner of its chat: the chat key and the place bar's Chat open
 * the chat page, and the place bar counts what is unread. A desktop's chat is the shared rail's own strip, so each
 * composition holds the chat's lifecycle once, and moving between them hands it over whole. The place bar's Log opens
 * the Events' history as a page, the same history the desktop's Events open in a window.
 */
const FrontierPhoneHud = ({
  rules,
  realm,
  board,
  depthSwitch,
  visiting,
  surface,
  onSurface,
  strip,
  purse,
  page,
  children,
  ...bands
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"] | null;
  /** The realm the dock reads: the player's, or the one visited. */
  board: NativeRows["Structure"] | null;
  depthSwitch?: ReactNode;
  visiting: boolean;
  surface: HudSurface | null;
  onSurface: (surface: HudSurface | null) => void;
  strip: ReactNode;
  purse: ReactNode;
  page: ReactNode;
  notices: ReactNode;
  action: ReactNode;
  dock: ReactNode;
  children: ReactNode;
}) => {
  const chat = useGameChat(surface === "chat");
  const chatPane = useChatKey(() => onSurface("chat"));
  const events = useUnreadImportantCount(surface === "feed");
  return (
    <HudBands
      {...bands}
      strip={strip}
      depthSwitch={depthSwitch}
      purse={purse}
      page={
        surface === "chat" ? (
          <ChatPage
            rooms={chat.rooms}
            signedIn={chat.initializer !== null}
            onSignIn={chat.requestSignIn}
            pane={chatPane}
            onClose={() => onSurface(null)}
          />
        ) : (
          page
        )
      }
      nav={
        // A player's visit trades the nav for its Leave; a spectator, with no realm to go back to, keeps it.
        !(visiting && realm) && (
          <FrontierNav
            rules={rules}
            realm={realm}
            board={board}
            surface={surface}
            onSurface={onSurface}
            events={events}
            unread={chat.unread}
          />
        )
      }
    >
      {children}
    </HudBands>
  );
};

/**
 * A phone's action row, the one row over the place bar that says what the pick lets the player do now (owner, 22 October
 * 2026: mobile direction A): with an order pending, its costs and verb; with the next order queued, its bar; with an
 * army picked, the army (a tap opens its card), its four sides, its stamina reading, and Level up; otherwise
 * nothing. A desktop has none: its orders go from the map, and the army's state is its panel's.
 */
const ArmyAction = ({
  rules,
  realm,
  onOpenArmy,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  /** Opens an army's panel (useArmyPanelOpens), on its level-up choices when `choosing`; none on a visit. */
  onOpenArmy?: (explorerId: number) => void;
}) => {
  const armies = useDockArmies(realm);
  const order = useArmyOrder();
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const nextOrder = useUIStore((state) => state.entityActions.nextOrder);
  const ordersAllowed = useUIStore(canIssueOrders);
  const selected = armies.find((army) => army.explorerId === selectedId);
  const acting = selected && ordersAllowed && onOpenArmy ? selected : undefined;
  if (order && selected) return <PendingOrder rules={rules} realm={realm} order={order} army={selected} />;
  if (selected && nextOrder?.entityId === selected.explorerId)
    return <NextOrderBar onCancel={() => dropNextOrder("cancelled", selected.explorerId)} />;
  if (acting && onOpenArmy) return <ActingArmy army={acting} onOpenArmy={onOpenArmy} />;
  return null;
};

/** The picked army in a phone's action row, with Spire while it stands at its spire. */
const ActingArmy = ({ army, onOpenArmy }: { army: DockArmy; onOpenArmy: (explorerId: number) => void }) => {
  const spire = useArmySpireStatus(army.explorerId);
  const held = useFragmentsHeld();
  return (
    <PickedArmy
      army={army}
      refill={
        sellsStamina(army, held) ? (
          <ArmyRefill army={army} look="reading" />
        ) : (
          army.stamina && <StaminaReading stamina={army.stamina} />
        )
      }
      spire={spire}
      onDetails={() => onOpenArmy(army.explorerId)}
    />
  );
};

/** The dock over the realm's armies today; on a phone the action row takes its place while an army is picked. */
const DockFor = ({
  realm,
  onOpenArmy,
}: {
  realm: NativeRows["Structure"];
  onOpenArmy?: (explorerId: number) => void;
}) => {
  const armies = useDockArmies(realm);
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const phone = useLayout() === "phone";
  if (phone && armies.some((army) => army.explorerId === selectedId)) return null;
  return <ArmyDock realm={realm} armies={armies} onOpenArmy={onOpenArmy} />;
};

const PendingOrder = ({
  rules,
  realm,
  order,
  army,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  order: ArmyOrder;
  army: DockArmy;
}) => {
  const labor = useRealmStores(realm, rules)?.labor;
  const held = useFragmentsHeld();
  return (
    <OrderBar
      kind={order.kind}
      tiles={order.tiles}
      stamina={order.stamina}
      wheat={order.wheat}
      revealYield={useArmyRevealYield(army)}
      laborFits={
        labor?.limit === undefined || labor.amount === undefined ? undefined : Math.max(0, labor.limit - labor.amount)
      }
      refill={sellsStamina(army, held) ? <ArmyRefill army={army} look="button" /> : undefined}
      onCancel={() => useUIStore.getState().updateEntityActionHoveredHex(null)}
      onGo={() => requestOrderAt(order.target)}
    />
  );
};

/** The Menu page over the game: each row opens its way and closes the menu; Exit leaves for the app. */
const HudMenu = ({ onOpen, onClose }: { onOpen: (surface: HudSurface | null) => void; onClose: () => void }) => {
  const navigate = useNavigate();
  const rank = useSeasonRank();
  const guide = useHowToPlay();
  return (
    <MenuPage
      rank={rank}
      onToday={() => onOpen("today")}
      onSeason={() => onOpen("season")}
      onSettings={() => onOpen("settings")}
      guide={guide}
      onExit={() => navigate("/")}
      onClose={onClose}
    />
  );
};

const REALM_PANEL_MODELS = [
  "Building",
  "HomeAspect",
  "RealmKnowledge",
  "Structure",
  "StructureBuildings",
  "BoardRules",
] as const;

const FrontierRealmPanel = ({
  rules,
  realm,
  own,
  storeCards,
  onSurface,
  onResearch,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  own: NativeRows["Structure"] | null;
  storeCards: ComponentProps<typeof RealmPanel>["storeCards"];
  onSurface: (surface: HudSurface) => void;
  onResearch: (node?: string) => void;
}) => {
  const facts = useNativeFacts(REALM_PANEL_MODELS);
  const tick = useCurrentDefaultTick();
  const requestedSimpleCost = useUIStore((state) => state.useSimpleCost);
  const useSimpleCost = resolveUseSimpleCost(configManager.buildingCostMode, requestedSimpleCost);
  const name = useGameModeConfig().structure.getName(realm).name;
  const stores = useStoreReadings(realm, rules);
  const armies = useDockArmies(realm);
  const research = useResearchTree(own);
  const goToPlace = useGoToFrontierPlace(realm);
  const fragments = useFragmentsChip();
  const aspectId = facts.store.get("HomeAspect", { game_id: realm.game_id, home: realm.entity_id })?.aspect;
  const aspect = aspectId !== undefined ? catalogAspectId(aspectId) : undefined;
  const options = facts.store.get("BoardRules", { game_id: realm.game_id })
    ? (readBuildOptions(facts.store, realm, useSimpleCost, tick) ?? [])
    : [];
  const isListed = (option: (typeof options)[number]) =>
    option.category !== BuildingType.WorkersHut && typeof option.standing === "string" && option.rise.standing > 0;
  const buildings: RealmBuildingItem[] = options
    .filter(isListed)
    .slice(0, 4)
    .map((option) => {
      const label = buildingName(option.category);
      const node = research?.nodes.find((candidate) => candidate.name === label && candidate.state !== "done");
      return {
        key: String(option.category),
        icon: buildingIcon(option.category),
        name: label,
        tier: option.tier,
        rateIcon:
          option.effect.kind === "produces" ? FRONTIER_STORES[madeStore(option.effect.resource)].icon : undefined,
        rate: option.effect.kind === "produces" ? formatRate(option.effect.output.total) : undefined,
        onUpgrade: own && node ? () => onResearch(node.key) : undefined,
      };
    });
  const openDeploy = () => {
    if (!own) return;
    openArmyDeployment({ structureId: safeInteger(own.entity_id), isExplorer: true });
  };
  return (
    <RealmPanel
      name={name}
      kind={homeKind(realm.metadata.has_wonder)}
      level={realm.base.level}
      highest={configManager.getMaxLevel(StructureType.Realm)}
      aspect={aspect}
      orderId={realm.metadata.order}
      armies={{ active: armies.length, limit: realm.base.troop_max_explorer_count }}
      stores={stores}
      buildings={buildings}
      onHome={() => goToPlace(true)}
      {...(own && {
        storeCards,
        onResearch: () => onResearch(),
        onDeploy: openDeploy,
        ...(fragments !== null && { fragments, onShop: () => onSurface("shop") }),
      })}
    />
  );
};

const useFragmentsChip = (): number | null => {
  const shown = usePartShown("fragments-chip");
  const fragments = useFragmentsHeld();
  return shown ? fragments : null;
};
