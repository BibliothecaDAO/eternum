import { useCurrentBlockTimestamp, useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders, isWatching } from "@/utils/can-issue-orders";
import { useRealmVisit } from "@/sync/active-game-client";
import { dropNextOrder } from "@/three/scenes/worldmap-next-order";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { CASTLE, SETTINGS } from "@/ui/design-system/kit/words";
import { useGameChat } from "@/ui/features/world/containers/hud-chat-window";
import { IdentityChip } from "@/ui/features/world/containers/top-header/identity-chip";
import { HudSheet } from "@/ui/design-system/kit/hud-elements";
import { useUnreadImportantCount } from "@/ui/features/event-feed/quick-feed";
import { SettingsPanel } from "@/ui/modules/settings/settings";
import { configManager, resolveUseSimpleCost } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { BUILDINGS_CENTER, catalogAspectId, formatRate, rankName, ResourcesIds } from "@bibliothecadao/types";
import { useLayout } from "@/shell/frame/layout";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { type ComponentProps, type ComponentType, type ReactNode, useEffect, useRef, useState } from "react";
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
import { AspectStandingChip } from "./hud/aspect-standing-chip";
import { useChatKey } from "./hud/chat-key";
import { DailyQuestChip } from "./hud/daily-quest-chip";
import { FrontierDesktop, FrontierPlaces } from "./hud/frontier-desktop";
import { FrontierFeed } from "./hud/frontier-feed";
import { HeaderStores } from "./hud/header-stores";
import { RealmHeaderChip } from "./hud/realm-header-chip";
import { useResearchTree } from "./research/research-facts";
import { canResearchNow } from "./research/research-tree";
import { ChatPage } from "./hud/chat-page";
import { type DockArmy, useDockArmies } from "./hud/dock-armies";
import { PhoneWorldActions, type HudSurface } from "./hud/frontier-nav";
import { useMapLayers } from "./hud/map-layers";
import { PhoneTopBar } from "./hud/phone-top-bar";
import { SurfaceDeepSwitch } from "./hud/surface-deep-switch";
import { useOnePanel, useOrderSettledReturnsToTheArmy } from "./hud/one-panel";
import { FrontierDayClock } from "./hud/day-pill";
import { DayEndBlock, DayEndNotice, useDayEnd } from "./day-end/day-end";
import { useFirstBuild, useMarkFirstBuild } from "./build/first-build";
import { useStoreReadings } from "./hud/frontier-strip";
import { RealmPanel, type RealmBuildingItem } from "./hud/realm-panel";
import { HudBands } from "./hud/hud-bands";
import { MenuPage } from "./hud/menu-page";
import { useHowToPlay } from "@/ui/modules/how-to-play";
import { useFragmentsHeld } from "./value/fragments";
import { ShopSheet, useReturnToShop } from "./shop/shop-sheet";
import { homeIcon, homeKind } from "@/ui/design-system/home-icons";
import { OfflineNotice } from "./hud/offline-notice";
import { SceneFailureNotice } from "./hud/scene-failure-notice";
import { NextOrderBar, OrderBar } from "./hud/order-bar";
import { PickedArmy } from "./hud/picked-army";
import { ArmyRefill, sellsStamina } from "./army/army-refill";
import { useArmySpireStatus } from "./spire-card";
import { OpeningProvider, usePartShown } from "./opening/opening-context";
import { OpeningOffer } from "./opening/opening-offer";
import { useOpening } from "./opening/use-opening";
import { useSiteAlertOffer } from "./opening/use-site-alert-offer";
import { AspectEmissaryDock } from "./tutorial/aspect-emissary-dock";
import { FrontierToday } from "./log/frontier-today";
import { CARD_STORE_KINDS, type CardStore, FrontierStoreCard, isCardStore } from "./production/frontier-store-card";
import { castleLabor } from "./production/store-makers";
import { FrontierResearch } from "./research/frontier-research";
import { ARMY_RELIC_MODELS, countRealmRelics, readRealmArmyRelics } from "./relics/army-relics";
import { FrontierRelics } from "./relics/frontier-relics";

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
  const { opened, line, dismiss, skipAll, offerDue } = useOpening(props.rules, visit ? null : realm);
  const offer = useSiteAlertOffer(offerDue);
  return (
    <OpeningProvider opened={opened}>
      <FrontierHudBody {...props} opening={{ line, offer, dismiss, skipAll }} />
    </OpeningProvider>
  );
};

const FrontierHudBody = ({
  rules,
  seasonOver: SeasonOver,
  opening,
}: FrontierHudProps & {
  opening: Pick<ReturnType<typeof useOpening>, "line" | "dismiss" | "skipAll"> & {
    offer: ReturnType<typeof useSiteAlertOffer>;
  };
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
  const [openStore, setOpenStore] = useState<CardStore | null>(null);
  const [realmOpen, setRealmOpen] = useState(() => !isMapView);
  const previousMapView = useRef(isMapView);
  useEffect(() => {
    if (previousMapView.current === isMapView) return;
    previousMapView.current = isMapView;
    setRealmOpen(!isMapView);
    setSurface(null);
  }, [isMapView, setSurface]);
  const chat = useGameChat(surface === "chat");
  const chatPane = useChatKey(() => setSurface("chat"));
  const headerStores = useStoreReadings(shown, rules);
  const headerFacts = useNativeFacts(REALM_HEADER_MODELS);
  const relicNow = useCurrentBlockTimestamp();
  const own = realm && !visit ? realm : null;
  const ownArmies = useDockArmies(own);
  const relicCount = own
    ? countRealmRelics(readRealmArmyRelics(headerFacts.store, own.game_id, ownArmies, relicNow))
    : 0;
  const modeConfig = useGameModeConfig();
  const goToPlace = useGoToFrontierPlace(shown);
  const feedUnread = useUnreadImportantCount(surface === "feed");
  const shownName = shown ? modeConfig.structure.getName(shown).name : null;
  const shownAspectId = shown
    ? headerFacts.store.get("HomeAspect", { game_id: shown.game_id, home: shown.entity_id })?.aspect
    : undefined;
  const shownAspect = shownAspectId !== undefined ? catalogAspectId(shownAspectId) : undefined;
  if (showBlankOverlay) return null;
  const close = () => setSurface(null);
  const switchView = (toRealm: boolean) => {
    close();
    goToPlace(!toRealm);
  };
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

  const depthSwitch = <SurfaceDeepSwitch layers={layers} onSwitch={close} />;
  const page =
    surface === "research" && realm ? (
      <FrontierResearch key={researchPick} realm={realm} pick={researchPick} onClose={close} />
    ) : surface === "season" ? (
      <FrontierSeason rules={rules} onVisited={close} onClose={close} />
    ) : surface === "feed" ? (
      <FrontierFeed onClose={close} />
    ) : surface === "chat" ? (
      <ChatPage
        rooms={chat.rooms}
        signedIn={chat.initializer !== null}
        onSignIn={chat.requestSignIn}
        pane={chatPane}
        onClose={close}
      />
    ) : surface === "relics" && own ? (
      <FrontierRelics realm={own} onClose={close} />
    ) : surface === "menu" ? (
      <HudMenu
        onOpen={setSurface}
        onClose={close}
        hasRealm={Boolean(own)}
        researchReady={own ? canResearchNow(research?.nodes) : false}
        events={feedUnread}
        chatUnread={chat.unread}
        fragments={own ? fragments : null}
      />
    ) : undefined;
  const realmVisible = Boolean(shown) && (desktop ? realmOpen && !page : surface === "realm");
  const phoneStrip = (
    <PhoneTopBar
      rules={rules}
      realm={shown}
      own={own}
      stores={headerStores}
      isMapView={isMapView}
      realmOpen={realmVisible}
      depthSwitch={depthSwitch}
      spectatorChip={spectating ? <IdentityChip compact /> : undefined}
      storeCards={storeCards}
      onOpenRealm={() => setSurface(surface === "realm" ? null : "realm")}
      onOpenToday={() => setSurface("today")}
    />
  );
  const showOpening = !(desktop && (surface !== null || showsCard));
  const notices = (
    <>
      {showOpening && (opening.line || opening.offer) && (
        <div data-opening-notice className="flex flex-col gap-1.5 empty:hidden">
          {opening.line && (
            <AspectEmissaryDock
              moment={opening.line.moment}
              rules={opening.line.rules}
              layout={desktop ? "desktop" : "phone"}
              onDismiss={opening.dismiss}
              onSkipAll={opening.skipAll}
            />
          )}
          {opening.offer && <OpeningOffer offer={opening.offer} />}
        </div>
      )}
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
  const railSheet =
    surface === "army" && realm && !visit ? (
      <FrontierArmy realm={realm} onClose={close} />
    ) : surface === "army-lost" ? (
      <ArmyLostSheet onClose={close} />
    ) : surface === "shop" && own ? (
      <ShopSheet realm={own} onClose={close} />
    ) : surface === "settings" ? (
      <HudSheet label={SETTINGS} onClose={close}>
        <SettingsPanel />
      </HudSheet>
    ) : surface === "today" ? (
      <FrontierToday
        rules={rules}
        realm={realm ?? visited}
        dayEnd={own && <DayEndBlock dayEnd={dayEnd} />}
        own={Boolean(own)}
        onClose={close}
      />
    ) : null;
  const realmPanel = shown && (
    <FrontierRealmPanel
      rules={rules}
      realm={shown}
      own={own}
      isMapView={isMapView}
      storeCards={storeCards}
      onResearch={(node) => {
        setResearchPick(node);
        setSurface("research");
      }}
      onClose={() => (desktop ? setRealmOpen(false) : close())}
      sheetHandle={!desktop}
    />
  );
  const armyDock = shown ? <DockFor realm={shown} onOpenArmy={desktop ? openArmy : pickArmy} /> : null;
  const sheets = (
    <>
      <FrontierSurfaces realm={realm} rules={rules} />
      {showsCard && card?.sheet}
      {railSheet}
      {surface !== "season" && <SeasonOver />}
      {realm && <DayDone rules={rules} realm={realm} visiting={Boolean(visit)} />}
      <BuildingsInFlight />
      <FrontierOathPick realm={realm} />
    </>
  );

  const phoneActions = (
    <PhoneWorldActions
      aspect={shownAspect}
      surface={surface}
      onSurface={setSurface}
      isMapView={isMapView}
      onSwitchView={switchView}
      researchReady={own ? canResearchNow(research?.nodes) : false}
      events={feedUnread}
      unread={chat.unread}
    />
  );

  const phoneDockActions = surface === null || surface === "realm";
  return desktop ? (
    <FrontierDesktop
      identity={
        shown && shownName && !spectating ? (
          <RealmHeaderChip
            owner={shown.owner}
            name={shownName}
            level={shown.base.level}
            aspect={shownAspect}
            expanded={realmVisible}
            onPress={() => setRealmOpen((open) => !open)}
          />
        ) : undefined
      }
      season={aspectsOpen ? { rank: seasonRank, onOpen: () => setSurface("season") } : undefined}
      clock={<FrontierDayClock rules={rules} onOpenToday={() => setSurface("today")} />}
      quest={own ? <DailyQuestChip realm={own} /> : undefined}
      stores={
        shown ? (
          <HeaderStores
            stores={headerStores}
            storeCards={storeCards}
            showPopoverCard={!realmVisible}
            fragments={own ? fragments : null}
            onShop={own ? () => setSurface("shop") : undefined}
          />
        ) : undefined
      }
      depthSwitch={isMapView ? depthSwitch : undefined}
      banner={<OfflineNotice />}
      realm={realmOpen ? realmPanel : null}
      armies={!page ? armyDock : null}
      aspectChip={
        isMapView && shown ? (
          <AspectStandingChip orderId={shown.metadata.order} onOpenSeason={() => setSurface("season")} />
        ) : undefined
      }
      page={page}
      widePage={
        surface === "research" ||
        (surface === "season" &&
          headerFacts.store.get("RaceRules", { game_id: configManager.getActiveGameId() }) !== undefined)
      }
      foot={
        <>
          {notices}
          {action}
        </>
      }
      places={
        <FrontierPlaces
          surface={surface}
          onSurface={setSurface}
          research={own ? canResearchNow(research?.nodes) : undefined}
          chatUnread={chat.unread}
          relics={relicCount}
          hasRealm={Boolean(own)}
        />
      }
    >
      {sheets}
    </FrontierDesktop>
  ) : (
    <HudBands
      strip={phoneStrip}
      banner={<OfflineNotice />}
      page={page}
      notices={notices}
      action={action}
      dock={
        <div className="flex flex-col gap-1.5">
          {realmVisible && realmPanel}
          <div className="frontier-phone-foot">
            <div className="min-w-0 flex-1">{armyDock}</div>
            {phoneDockActions && phoneActions}
          </div>
        </div>
      }
      nav={!phoneDockActions ? <div className="flex justify-end">{phoneActions}</div> : null}
    >
      {sheets}
    </HudBands>
  );
};

const REALM_HEADER_MODELS = ["HomeAspect", "RaceRules", ...ARMY_RELIC_MODELS] as const;

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
      refill={sellsStamina(army, held) ? <ArmyRefill army={army} look="reading" /> : undefined}
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
const HudMenu = ({
  onOpen,
  onClose,
  hasRealm,
  researchReady,
  events,
  chatUnread,
  fragments,
}: {
  onOpen: (surface: HudSurface | null) => void;
  onClose: () => void;
  hasRealm: boolean;
  researchReady: boolean;
  events: number;
  chatUnread: number;
  fragments: number | null;
}) => {
  const navigate = useNavigate();
  const rank = useSeasonRank();
  const guide = useHowToPlay();
  return (
    <MenuPage
      rank={rank}
      onResearch={hasRealm ? () => onOpen("research") : undefined}
      onFeed={() => onOpen("feed")}
      onChat={() => onOpen("chat")}
      onRelics={hasRealm ? () => onOpen("relics") : undefined}
      onShop={fragments !== null ? () => onOpen("shop") : undefined}
      researchReady={researchReady}
      events={events}
      chatUnread={chatUnread}
      fragments={fragments}
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
  "ResourceRule",
  "Structure",
  "StructureBuildings",
  "BoardRules",
] as const;

const FrontierRealmPanel = ({
  rules,
  realm,
  own,
  isMapView,
  storeCards,
  onResearch,
  onClose,
  sheetHandle = false,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  own: NativeRows["Structure"] | null;
  isMapView: boolean;
  storeCards: ComponentProps<typeof RealmPanel>["storeCards"];
  onResearch: (node?: string) => void;
  onClose?: () => void;
  sheetHandle?: boolean;
}) => {
  const facts = useNativeFacts(REALM_PANEL_MODELS);
  const tick = useCurrentDefaultTick();
  const requestedSimpleCost = useUIStore((state) => state.useSimpleCost);
  const useSimpleCost = resolveUseSimpleCost(configManager.buildingCostMode, requestedSimpleCost);
  const name = useGameModeConfig().structure.getName(realm).name;
  const stores = useStoreReadings(realm, rules);
  const castleRate = facts.store.get("ResourceRule", { game_id: realm.game_id, resource_type: ResourcesIds.Labor })
    ? castleLabor(facts.store, realm)
    : undefined;
  const armies = useDockArmies(realm);
  const research = useResearchTree(own);
  const goToPlace = useGoToFrontierPlace(realm);
  const aspectId = facts.store.get("HomeAspect", { game_id: realm.game_id, home: realm.entity_id })?.aspect;
  const aspect = aspectId !== undefined ? catalogAspectId(aspectId) : undefined;
  const options = facts.store.get("BoardRules", { game_id: realm.game_id })
    ? (readBuildOptions(facts.store, realm, useSimpleCost, tick) ?? [])
    : [];
  const isListed = (option: (typeof options)[number]) =>
    typeof option.standing === "string" && option.rise.standing > 0;
  const kind = homeKind(realm.metadata.has_wonder);
  const openCastle = () => {
    if (!own) return;
    useUIStore.getState().setSelectedBuildingHex({
      structureId: safeInteger(own.entity_id),
      innerCol: BUILDINGS_CENTER[0],
      innerRow: BUILDINGS_CENTER[1],
    });
  };
  const citadel: RealmBuildingItem = {
    key: "citadel",
    icon: homeIcon(kind, realm.base.level),
    name: CASTLE,
    rankLabel: rankName(realm.base.level),
    rateIcon: castleRate ? FRONTIER_STORES.labor.icon : undefined,
    rate: castleRate ? formatRate(castleRate) : undefined,
    onUpgrade: own ? openCastle : undefined,
  };
  const buildings: RealmBuildingItem[] = [
    citadel,
    ...options
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
      }),
  ];
  const openDeploy = () => {
    if (!own) return;
    openArmyDeployment({ structureId: safeInteger(own.entity_id), isExplorer: true });
  };
  return (
    <RealmPanel
      name={name}
      kind={kind}
      level={realm.base.level}
      aspect={aspect}
      orderId={realm.metadata.order}
      armies={{ active: armies.length, limit: realm.base.troop_max_explorer_count }}
      stores={stores}
      buildings={buildings}
      onHome={isMapView ? () => goToPlace(false) : undefined}
      onClose={onClose}
      sheetHandle={sheetHandle}
      {...(own && {
        storeCards,
        onResearch: () => onResearch(),
        onDeploy: openDeploy,
      })}
    />
  );
};

const useFragmentsChip = (): number | null => {
  const shown = usePartShown("fragments-chip");
  const fragments = useFragmentsHeld();
  return shown ? fragments : null;
};
