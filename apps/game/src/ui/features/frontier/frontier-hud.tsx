import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { reasonLine } from "@/ui/design-system/kit/reasons";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders, isWatching } from "@/utils/can-issue-orders";
import { useRealmVisit } from "@/sync/active-game-client";
import { dropNextOrder } from "@/three/scenes/worldmap-next-order";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { REALM_CARD_WORDS, SETTINGS } from "@/ui/design-system/kit/words";
import { HudChatWindow, useGameChat } from "@/ui/features/world/containers/hud-chat-window";
import { IdentityChip } from "@/ui/features/world/containers/top-header/identity-chip";
import { HudSheet } from "@/ui/design-system/kit/hud-elements";
import { useUnreadImportantCount } from "@/ui/features/event-feed/quick-feed";
import { SettingsPanel } from "@/ui/modules/settings/settings";
import { configManager } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { catalogAspectId, rankName } from "@bibliothecadao/types";
import { useLayout, useTablet } from "@/shell/frame/layout";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { type ComponentType, type ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RealmVisitFoot, useRealmVisitNavigation, useVisitedRealm } from "./board/realm-visit";
import { FrontierSeason, useSeasonRank } from "./board/season-board";
import { useSpectatorWatch } from "./board/spectator-watch";
import { useExpeditionRules, useFrontierRealm, useGoToFrontierPlace } from "./frontier-home";
import { ArmyLostSheet } from "./army/army-lost";
import { useArmyPanelOpens, usePickArmy } from "./army/army-opens";
import { FrontierArmy } from "./army/frontier-army";
import { FrontierOathPick } from "./army/oath-pick";
import { FightBanner } from "./sites/fight-banner";
import { RevealPill } from "./hud/reveal-pill";
import { useSelectionCard } from "./frontier-selection-sheet";
import { FrontierSurfaces } from "./frontier-surfaces";
import { type ArmyOrder, useArmyOrder } from "./hud/army-order";
import { ArmyDock } from "./hud/army-dock";
import { useChatKey } from "./hud/chat-key";
import { DailyQuestChip } from "./hud/daily-quest-chip";
import { FrontierDesktop, FrontierPlaces } from "./hud/frontier-desktop";
import { FrontierFeed } from "./hud/frontier-feed";
import { RealmCard } from "./hud/realm-card";
import { useResearchTree } from "./research/research-facts";
import { canResearchNow } from "./research/research-tree";
import { ChatPage } from "./hud/chat-page";
import { type DockArmy, useDockArmies } from "./hud/dock-armies";
import { PhoneTabBar, type HudSurface } from "./hud/frontier-nav";
import { selectLayer, useMapLayers } from "./hud/map-layers";
import { FrontierTopBar } from "./hud/phone-top-bar";
import { PlaceMenu, placeLines } from "./hud/surface-deep-switch";
import { useOnePanel, useOrderSettledReturnsToTheArmy } from "./hud/one-panel";
import { FrontierDayClock } from "./hud/day-pill";
import { useFirstBuild, useMarkFirstBuild } from "./build/first-build";
import { useStoreReadings } from "./hud/frontier-strip";
import type { RealmRankUp } from "./hud/realm-card";
import { castleUpgradeRefusal } from "./upgrade/castle-upgrade";
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
import { ArmyOathSockets } from "./army/oath-slots";
import { ArmyRefill, sellsStamina } from "./army/army-refill";
import { useArmySpireStatus } from "./spire-card";
import { OpeningProvider } from "./opening/opening-context";
import { OpeningOffer } from "./opening/opening-offer";
import { useOpening } from "./opening/use-opening";
import { useSiteAlertOffer } from "./opening/use-site-alert-offer";
import { AspectEmissaryDock } from "./tutorial/aspect-emissary-dock";
import { FrontierToday } from "./log/frontier-today";
import { type CardStore, FrontierStoreCard, isCardStore } from "./production/frontier-store-card";
import { FrontierResearch } from "./research/frontier-research";

import { useBuildOpensOnEntering } from "./build/build-button";
import { BuildingsInFlight, useRealmPlots } from "./build/build-sheet";
import { STORE_KINDS } from "./stores";
import { type LordsReading, useLordsBalance } from "@/shell/value/use-lords-balance";
import { usePayer } from "@/shell/value/use-payer";
import { useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
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
  const [openedSurface, setOpenedSurface] = useState<HudSurface | null>(null);
  const { opened, line, dismiss, skipAll, offerDue } = useOpening(props.rules, visit ? null : realm, openedSurface);
  const offer = useSiteAlertOffer(offerDue);
  return (
    <OpeningProvider opened={opened}>
      <FrontierHudBody {...props} opening={{ line, offer, dismiss, skipAll }} onSurfaceChange={setOpenedSurface} />
    </OpeningProvider>
  );
};

const FrontierHudBody = ({
  rules,
  seasonOver: SeasonOver,
  opening,
  onSurfaceChange,
}: FrontierHudProps & {
  opening: Pick<ReturnType<typeof useOpening>, "line" | "dismiss" | "skipAll"> & {
    offer: ReturnType<typeof useSiteAlertOffer>;
  };
  onSurfaceChange: (surface: HudSurface | null) => void;
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
  const noticeAtFoot = useTablet() || desktop;
  const { surface, openSurface: setSurface, showsCard } = useOnePanel(card?.key ?? null, !desktop);
  useEffect(() => {
    onSurfaceChange(surface);
  }, [surface, onSurfaceChange]);
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
  const seasonRank = useSeasonRank();
  const fragmentsHeld = useFragmentsHeld();
  const ordersAllowed = useUIStore(canIssueOrders);
  const layers = useMapLayers(rules, shown, visit ? null : realm);
  const [openStore, setOpenStore] = useState<CardStore | null>(null);
  const previousMapView = useRef(isMapView);
  useEffect(() => {
    if (previousMapView.current === isMapView) return;
    previousMapView.current = isMapView;
    setSurface(null);
  }, [isMapView, setSurface]);
  useBuildOpensOnEntering(desktop && !isMapView && ordersAllowed && realm && !visit ? realm : null);
  const chat = useGameChat(surface === "chat");
  const chatPane = useChatKey(() => setSurface("chat"), { enabled: !desktop });
  const headerStores = useStoreReadings(shown, rules);
  const headerFacts = useNativeFacts(REALM_HEADER_MODELS);
  const own = realm && !visit ? realm : null;
  const ownArmies = useDockArmies(own);
  const ownPlots = useRealmPlots(own);
  const modeConfig = useGameModeConfig();
  const goToPlace = useGoToFrontierPlace(shown);
  const feedUnread = useUnreadImportantCount(surface === "feed");
  const shownName = shown ? modeConfig.structure.getName(shown).name : null;
  if (showBlankOverlay) return null;
  const close = () => setSurface(null);
  const switchView = (toRealm: boolean) => {
    close();
    goToPlace(!toRealm);
  };
  const storeCards = own
    ? {
        onToggle: (kind: string) => {
          if (isCardStore(kind)) setOpenStore((open) => (open === kind ? null : kind));
        },
        card: openStore && (
          <FrontierStoreCard rules={rules} realm={own} store={openStore} onDone={() => setOpenStore(null)} />
        ),
      }
    : undefined;

  const placeChoices = {
    isMapView,
    canOpenRealm: Boolean(shown),
    layers,
    onGoRealm: () => {
      if (isMapView) switchView(true);
      else close();
    },
    onGoSurface: () => {
      if (!isMapView) switchView(false);
      else if (layers) selectLayer(layers, 0, close);
      else close();
    },
    onSwitch: close,
  };
  const placeMenu = (
    <PlaceMenu
      {...placeChoices}
      realm={shown ? { mark: homeIcon(homeKind(shown.metadata.has_wonder), shown.base.level) } : undefined}
      lines={own ? placeLines(ownArmies, ownPlots) : undefined}
    />
  );
  const page =
    surface === "research" && realm ? (
      <FrontierResearch key={researchPick} realm={realm} pick={researchPick} onClose={close} />
    ) : surface === "season" ? (
      <FrontierSeason rules={rules} onVisited={close} onClose={close} />
    ) : surface === "feed" ? (
      <FrontierFeed onClose={close} />
    ) : surface === "chat" && !desktop ? (
      <ChatPage
        rooms={chat.rooms}
        signedIn={chat.initializer !== null}
        onSignIn={chat.requestSignIn}
        pane={chatPane}
        onClose={close}
      />
    ) : surface === "menu" ? (
      <HudMenu onOpen={setSurface} onClose={close} events={feedUnread} shop={Boolean(own) && fragmentsHeld !== null} />
    ) : undefined;
  const realmVisible = Boolean(shown) && surface === "realm";
  const placesState = {
    surface,
    onSurface: setSurface,
    researchReady: own ? canResearchNow(research?.nodes) : undefined,
    feedUnread,
    chatUnread: chat.unread,
  };
  const realmCard = shown && (
    <FrontierRealmCard
      rules={rules}
      realm={shown}
      own={own}
      isMapView={isMapView}
      fragments={own ? fragmentsHeld : null}
      storeCards={storeCards}
      onShop={own ? () => setSurface("shop") : undefined}
      onClose={desktop ? undefined : close}
    />
  );
  const widePage =
    surface === "research" ||
    (surface === "season" &&
      headerFacts.store.get("RaceRules", { game_id: configManager.getActiveGameId() }) !== undefined);
  const showOpening = !(desktop && widePage);
  const openingNotice = showOpening && (opening.line || opening.offer) && (
    <div data-opening-notice className="flex flex-col gap-1.5 empty:hidden">
      {opening.line && (
        <AspectEmissaryDock
          moment={opening.line.moment}
          rules={opening.line.rules}
          layout={desktop ? "desktop" : "phone"}
          status={opening.line.status}
          onDismiss={opening.dismiss}
          onSkipAll={opening.skipAll}
        />
      )}
      {opening.offer && <OpeningOffer offer={opening.offer} />}
    </div>
  );
  const topBar = (
    <FrontierTopBar
      rules={rules}
      stocks={{
        stores: headerStores,
        realmName: shownName,
        realmOpen: realmVisible,
        onOpenRealm: () => setSurface(surface === "realm" ? null : "realm"),
      }}
      placeMenu={placeMenu}
      quest={own ? <DailyQuestChip realm={own} /> : undefined}
      notice={noticeAtFoot ? undefined : openingNotice}
      spectatorChip={spectating ? <IdentityChip compact /> : undefined}
      realmCard={realmVisible ? realmCard : undefined}
      onOpenToday={() => setSurface("today")}
    />
  );
  const notices = (
    <>
      {noticeAtFoot && openingNotice}
      <SceneFailureNotice />
    </>
  );
  const action = (
    <>
      {shown && !desktop && isMapView && (
        <div data-army-action className="contents">
          <ArmyAction realm={shown} onOpenArmy={visit ? undefined : openArmy} />
        </div>
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
      <FrontierToday rules={rules} realm={realm ?? visited} own={Boolean(own)} onClose={close} />
    ) : null;
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
      <FightBanner />
      <RevealPill />
    </>
  );

  return desktop ? (
    <FrontierDesktop
      clock={<FrontierDayClock rules={rules} onOpenToday={() => setSurface("today")} />}
      quest={own ? <DailyQuestChip realm={own} /> : undefined}
      placeSwitch={placeMenu}
      chat={<HudChatWindow open={surface === "chat"} onOpenChange={(open) => setSurface(open ? "chat" : null)} />}
      banner={<OfflineNotice />}
      realm={realmCard}
      armies={armyDock}
      page={page}
      widePage={widePage}
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
          lead={
            spectating ? (
              <IdentityChip compact season={{ rank: seasonRank, onOpen: () => setSurface("season") }} />
            ) : undefined
          }
        />
      }
    >
      {sheets}
    </FrontierDesktop>
  ) : (
    <HudBands
      strip={topBar}
      banner={<OfflineNotice />}
      page={page}
      notices={notices}
      action={action}
      dock={
        <div className="frontier-phone-foot">
          <div className="min-w-0 flex-1">{armyDock}</div>
        </div>
      }
      nav={<PhoneTabBar {...placesState} />}
    >
      {sheets}
    </HudBands>
  );
};

const REALM_HEADER_MODELS = ["RaceRules"] as const;

/**
 * A phone's action row, the one row over the place bar that says what the pick lets the player do now (owner, 22 October
 * 2026: mobile direction A): with an order pending, its costs and verb; with the next order queued, its bar; with an
 * army picked, the army (a tap opens its card), its four sides, its stamina reading, and Level up; otherwise
 * nothing. A desktop has none: its orders go from the map, and the army's state is its panel's.
 */
const ArmyAction = ({
  realm,
  onOpenArmy,
}: {
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
  if (order && selected) return <PendingOrder order={order} army={selected} />;
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
      oaths={<ArmyOathSockets explorerId={army.explorerId} />}
      refill={sellsStamina(army, held) ? <ArmyRefill army={army} look="price" /> : undefined}
      spire={spire}
      onDetails={() => onOpenArmy(army.explorerId)}
      onClose={() => useUIStore.getState().deselectEntity()}
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

const PendingOrder = ({ order, army }: { order: ArmyOrder; army: DockArmy }) => {
  const held = useFragmentsHeld();
  return (
    <OrderBar
      kind={order.kind}
      stamina={order.stamina}
      wheat={order.wheat}
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
  events,
  shop,
}: {
  onOpen: (surface: HudSurface | null) => void;
  onClose: () => void;
  events: number;
  shop: boolean;
}) => {
  const navigate = useNavigate();
  const guide = useHowToPlay();
  return (
    <MenuPage
      onFeed={() => onOpen("feed")}
      onShop={shop ? () => onOpen("shop") : undefined}
      events={events}
      onToday={() => onOpen("today")}
      onSettings={() => onOpen("settings")}
      guide={guide}
      onExit={() => navigate("/")}
      onClose={onClose}
    />
  );
};

const REALM_PANEL_MODELS = ["HomeAspect"] as const;

const useRealmFace = (realm: NativeRows["Structure"]) => {
  const facts = useNativeFacts(REALM_PANEL_MODELS);
  const aspectId = facts.store.get("HomeAspect", { game_id: realm.game_id, home: realm.entity_id })?.aspect;
  return {
    name: useGameModeConfig().structure.getName(realm).name,
    kind: homeKind(realm.metadata.has_wonder),
    aspect: aspectId !== undefined ? catalogAspectId(aspectId) : undefined,
  };
};

type StoreCards = {
  onToggle: (kind: string) => void;
  card: ReactNode;
};

const FrontierRealmCard = ({
  realm,
  rules,
  own,
  isMapView,
  fragments,
  storeCards,
  onShop,
  onClose,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  own: NativeRows["Structure"] | null;
  isMapView: boolean;
  fragments: number | null;
  storeCards: StoreCards | undefined;
  onShop?: () => void;
  onClose?: () => void;
}) => {
  const { name, kind, aspect } = useRealmFace(realm);
  const stores = useStoreReadings(realm, rules, STORE_KINDS);
  const goToPlace = useGoToFrontierPlace(realm);
  const lords = useWalletLords();
  const rankUp = useRankUp(own);
  return (
    <RealmCard
      name={name}
      kind={kind}
      level={realm.base.level}
      rankUp={rankUp}
      aspect={aspect}
      orderId={realm.metadata.order}
      stores={stores}
      fragments={fragments}
      lords={own ? lords : null}
      storeCard={storeCards?.card}
      onStore={storeCards?.onToggle}
      onShop={onShop}
      onHome={isMapView ? () => goToPlace(false) : undefined}
      onClose={onClose}
    />
  );
};

const useRankUp = (own: NativeRows["Structure"] | null): RealmRankUp | undefined => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  const levelUp = useRealmLevelUp(own ? safeInteger(own.entity_id) : null);
  if (!own || !levelUp || levelUp.mode === "max") return undefined;
  const refusal = castleUpgradeRefusal(setup.store, own, levelUp, tick);
  const slots = configManager.getArmySlots(levelUp.nextLevel) - configManager.getArmySlots(levelUp.currentLevel);
  return {
    name: rankName(levelUp.nextLevel),
    gives: slots > 0 ? REALM_CARD_WORDS.armySlots(slots) : undefined,
    need: refusal?.reason.kind === "short" ? { of: refusal.reason.of, amount: refusal.reason.need } : undefined,
    refusal: refusal && reasonLine(refusal.reason),
    sending: levelUp.loading,
    onUpgrade: levelUp.ready || levelUp.loading ? levelUp.run : undefined,
  };
};

const useWalletLords = (): LordsReading => {
  const { payer, failed } = usePayer();
  const { reading } = useLordsBalance(payer ?? null);
  return failed ? "failed" : reading;
};
