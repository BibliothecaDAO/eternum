import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useHomeKind } from "@/hooks/helpers/use-home-kind";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useDocumentClass } from "@/hooks/use-document-class";
import { useHeldTicket } from "@/hooks/use-holdings";
import { getActiveGame } from "@/runtime/world";
import { campaignOfPreset } from "@/services/home-claim-rules";
import { useLayout } from "@/shell/frame/layout";
import { useRealmVisit } from "@/sync/active-game-client";
import { dropNextOrder } from "@/three/scenes/worldmap-next-order";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { HudSheet } from "@/ui/design-system/kit/hud-elements";
import { SETTINGS } from "@/ui/design-system/kit/words";
import { useUnreadImportantCount } from "@/ui/features/event-feed/quick-feed";
import { useGameChat } from "@/ui/features/world/containers/hud-chat-window";
import { IdentityChip } from "@/ui/features/world/containers/top-header/identity-chip";
import { useHowToPlay } from "@/ui/modules/how-to-play";
import { SettingsPanel } from "@/ui/modules/settings/settings";
import { canIssueOrders, isWatching } from "@/utils/can-issue-orders";
import { configManager } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { type ComponentProps, type ComponentType, type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArmyLostSheet } from "./army/army-lost";
import { useArmyPanelOpens, usePickArmy } from "./army/army-opens";
import { FrontierArmy } from "./army/frontier-army";
import { RealmVisitFoot, useRealmVisitNavigation, useVisitedRealm } from "./board/realm-visit";
import { FrontierSeason, useSeasonRank } from "./board/season-board";
import { useSpectatorWatch } from "./board/spectator-watch";
import { BuildingsInFlight } from "./build/build-sheet";
import { useFirstBuild, useMarkFirstBuild } from "./build/first-build";
import { DayEndBlock, DayEndNotice, useDayEnd } from "./day-end/day-end";
import { useExpeditionRules, useFrontierRealm, useGoToFrontierPlace } from "./frontier-home";
import { useArmyRevealYield } from "./frontier-reveal-yield";
import { useSelectionCard } from "./frontier-selection-sheet";
import { FrontierSurfaces } from "./frontier-surfaces";
import { ArmyDock } from "./hud/army-dock";
import { type ArmyOrder, useArmyOrder } from "./hud/army-order";
import { StaminaReading } from "./hud/army-token";
import { useChatKey } from "./hud/chat-key";
import { ChatPage } from "./hud/chat-page";
import { dayClock } from "./hud/day-clock";
import { FrontierDayClock } from "./hud/day-pill";
import { type DockArmy, useDockArmies } from "./hud/dock-armies";
import { FrontierDesktop, FrontierPlaces } from "./hud/frontier-desktop";
import { FrontierFeed } from "./hud/frontier-feed";
import { FrontierNav, type HudSurface } from "./hud/frontier-nav";
import { layerTab, type MapLayers, useMapLayers } from "./hud/map-layers";
import { useOnePanel, useOrderSettledReturnsToTheArmy } from "./hud/one-panel";
import { FrontierDayBanner } from "./day/day-banner";
import { OpeningLine } from "./opening/opening-line";
import { useOpeningInterface, useOpens } from "./opening/use-opening";
import { FrontierStrip, useStoreReadings } from "./hud/frontier-strip";
import { HudBands } from "./hud/hud-bands";
import { MenuPage } from "./hud/menu-page";
import { FrontierRealms } from "./value/frontier-realms";
import { useCampaignMark } from "./value/campaign-home";
import { dailyClaimWaiting, type DailyClaimWaiting } from "./value/realm-labor";
import { useRealmLabor } from "./value/use-realm-labor";
import { PurseRow, RealmsChip } from "./value/lords-purse";
import { OfflineNotice } from "./hud/offline-notice";
import { NextOrderBar, OrderBar } from "./hud/order-bar";
import { PickedArmy } from "./hud/picked-army";
import { RealmPanel } from "./hud/realm-panel";
import { SceneFailureNotice } from "./hud/scene-failure-notice";
import { FrontierToday } from "./log/frontier-today";
import { CARD_STORE_KINDS, type CardStore, FrontierStoreCard, isCardStore } from "./production/frontier-store-card";
import { useRealmStores } from "./realm-stores";
import { useRealmPopulation } from "./realm/realm-population";
import { FrontierResearch } from "./research/frontier-research";
import { useResearchTree } from "./research/research-facts";
import { canResearchNow } from "./research/research-tree";
import { DayDone } from "./rollover/day-done";
import { SpireButton, useArmyAtItsSpire } from "./spire-card";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

/**
 * Frontier's HUD, one set of parts in two compositions (the desktop's shared regions, a phone's bands): the realm and
 * its stores, a nav page or the map, the action bar while an army is selected, the armies and the places.
 * Everything else opens from these as a sheet.
 */
export const FrontierHud = ({
  rules,
  seasonOver: SeasonOver,
}: {
  rules: ExpeditionRules;
  /** The host owns the shell recap; the HUD supplies the player's realm and pending payout. */
  seasonOver: ComponentType<{
    realm: NativeRows["Structure"] | null;
    withdraw?: ReactNode;
  }>;
}) => {
  // Parts shared with the Blitz and Eternum HUD read upright, untracked and in sentence case here (index.css).
  useDocumentClass("frontier-hud");
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const spectating = useUIStore(isWatching);
  // A player's ticket to this season's campaign, read as they play: the read settles what friends earned and asks for
  // a golden upgrade earned for this home, so it lands without a visit to You.
  useHeldTicket(spectating ? null : campaignOfPreset(getActiveGame()?.presetId ?? -1));
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
  // The HUD opens as the player's own realm plays; watching or visiting, it shows everything.
  useOpeningInterface(visit || spectating ? null : realm);
  const card = useSelectionCard({
    realm: shown,
    onResearch: (node) => {
      setResearchPick(node);
      setSurface("research");
    },
  });
  const desktop = useLayout() === "desktop";
  const { surface, openSurface: setSurface, showsCard } = useOnePanel(card?.key ?? null, !desktop);
  const showsResearch = useOpens("research");
  const openToday = useOpens("today") ? () => setSurface("today") : undefined;
  const realmLabor = useRealmLabor(rules, realm);
  const claimWaiting = dailyClaimWaiting(realmLabor?.plan);
  const research = useResearchTree(realm);
  useEffect(() => {
    if (surface !== "research") setResearchPick(undefined);
  }, [surface]);
  // Selecting one of the realm's armies opens its panel; a pick in the dock or Today goes the same way.
  const [armyChoosing, setArmyChoosing] = useState(false);
  const armyPanel = useArmyPanelOpens(
    visit ? null : realm,
    (choosing) => {
      setArmyChoosing(choosing);
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
    claimWaiting: claimWaiting !== null,
    onClaim: () => setSurface("realms"),
    onPickArmy: desktop
      ? openArmy
      : (explorerId) => {
          pickArmy(explorerId);
          setSurface(null);
        },
  });
  const seasonRank = useSeasonRank();
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

  // The day's banner: the player's own realm's quest, under the strip on a phone and the realm panel on a desktop.
  const dayBanner = own && <FrontierDayBanner realm={own} />;
  const strip = (
    <>
      <FrontierStrip rules={rules} realm={shown} onOpenDay={openToday} storeCards={storeCards} />
      {storeCards?.open && storeCards.card}
      {dayBanner}
    </>
  );
  // A phone shows the pending home claim; spectators see their identity.
  const purse = spectating ? (
    <IdentityChip compact />
  ) : (
    realm &&
    !visit &&
    claimWaiting && (
      <PurseRow>
        <RealmsChip waiting={claimWaiting} narrow onOpen={() => setSurface("realms")} />
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
      <HudMenu realm={realm} claimWaiting={claimWaiting !== null} onOpen={setSurface} onClose={close} />
    ) : undefined;
  const notices = (
    <>
      <OfflineNotice />
      <SceneFailureNotice />
      {own && <DayEndNotice dayEnd={dayEnd} onOpen={() => setSurface("today")} />}
      {own && <OpeningLine realm={own} />}
    </>
  );
  const action = (
    <>
      {shown && !desktop && <ArmyAction rules={rules} realm={shown} onOpenArmy={visit ? undefined : openArmy} />}
      <RealmVisitFoot home={realm} />
    </>
  );
  // A phone's dock picks an army, the map first; a desktop's opens its panel too.
  const dock = shown && <DockFor rules={rules} realm={shown} onOpenArmy={desktop ? openArmy : pickArmy} />;
  const sheets = (
    <>
      <FrontierSurfaces realm={realm} rules={rules} />
      {showsCard && card?.sheet}
      {surface === "realms" && realm && !visit && <FrontierRealms labor={realmLabor} onClose={close} />}
      {surface === "army" && realm && !visit && <FrontierArmy realm={realm} choosing={armyChoosing} onClose={close} />}
      {surface === "army-lost" && <ArmyLostSheet onClose={close} />}
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
          onOpenArmy={realm && !visit ? openArmy : undefined}
          onClose={close}
        />
      )}
      {/* A board open as the season ends stays until closed. */}
      {surface !== "season" && <SeasonOver realm={visit ? null : realm} />}
      {realm && <DayDone rules={rules} realm={realm} visiting={Boolean(visit)} />}
      <BuildingsInFlight />
    </>
  );

  return desktop ? (
    <FrontierDesktop
      season={{ rank: seasonRank, onOpen: () => setSurface("season") }}
      clock={<FrontierDayClock rules={rules} onOpenToday={openToday} />}
      worldTab={layers ? layerTab(layers) : undefined}
      realm={
        shown && (
          <>
            <FrontierRealmPanel
              rules={rules}
              realm={shown}
              own={own}
              waiting={claimWaiting}
              storeCards={storeCards}
              onSurface={setSurface}
            />
            {dayBanner}
          </>
        )
      }
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
            research={realm && showsResearch ? canResearchNow(research?.nodes) : undefined}
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
      layers={layers}
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
  layers,
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
  layers: MapLayers | null;
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
            layers={layers}
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
  onOpenArmy?: (explorerId: number, choosing?: boolean) => void;
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
const ActingArmy = ({
  army,
  onOpenArmy,
}: {
  army: DockArmy;
  onOpenArmy: (explorerId: number, choosing?: boolean) => void;
}) => {
  const spire = useArmyAtItsSpire(army.explorerId);
  return (
    <PickedArmy
      army={army}
      refill={army.stamina && <StaminaReading stamina={army.stamina} />}
      spire={spire && <SpireButton explorerId={army.explorerId} spire={spire} />}
      onDetails={() => onOpenArmy(army.explorerId)}
      onLevelUp={() => onOpenArmy(army.explorerId, army.canSpendSkillPoint)}
    />
  );
};

/** The dock over the realm's armies today; on a phone the action row takes its place while an army is picked. */
const DockFor = ({
  rules,
  realm,
  onOpenArmy,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  onOpenArmy?: (explorerId: number) => void;
}) => {
  const armies = useDockArmies(realm);
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const phone = useLayout() === "phone";
  const lastHour = dayClock(rules, useNowSeconds()).tone === "ember";
  if (phone && armies.some((army) => army.explorerId === selectedId)) return null;
  return <ArmyDock realm={realm} armies={armies} lastHour={lastHour} onOpenArmy={onOpenArmy} />;
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
      xp={order.xp}
      onCancel={() => useUIStore.getState().updateEntityActionHoveredHex(null)}
      onGo={() => requestOrderAt(order.target)}
    />
  );
};

/** The Menu page over the game: each row opens its way and closes the menu; Exit leaves for the app. */
const HudMenu = ({
  realm,
  claimWaiting,
  onOpen,
  onClose,
}: {
  realm: NativeRows["Structure"] | null;
  /** Whether the home's daily claim has Labor or Essence waiting today: the Realms row wears a dot. */
  claimWaiting: boolean;
  onOpen: (surface: HudSurface | null) => void;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const rank = useSeasonRank();
  const guide = useHowToPlay();
  return (
    <MenuPage
      rank={rank}
      onToday={() => onOpen("today")}
      onSeason={() => onOpen("season")}
      realms={realm ? { waiting: claimWaiting, onOpen: () => onOpen("realms") } : undefined}
      onSettings={() => onOpen("settings")}
      guide={guide}
      onExit={() => navigate("/")}
      onClose={onClose}
    />
  );
};

/**
 * The desktop's realm panel over the realm the HUD reads (the player's, or the one watched or visited): its name and
 * rank's steps in a header that takes the map home to it, its population and stores, and for the player's own realm
 * its daily home claim and each store's card.
 */
const FrontierRealmPanel = ({
  rules,
  realm,
  own,
  waiting,
  storeCards,
  onSurface,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  /** The player's own realm, the one read; null while watching or visiting. */
  own: NativeRows["Structure"] | null;
  waiting: DailyClaimWaiting | null;
  storeCards: ComponentProps<typeof RealmPanel>["storeCards"];
  onSurface: (surface: HudSurface) => void;
}) => {
  const name = useGameModeConfig().structure.getName(realm).name;
  const stores = useStoreReadings(realm, rules);
  const population = useRealmPopulation(realm);
  const goToPlace = useGoToFrontierPlace(realm);
  const mark = useCampaignMark(realm);
  const kind = useHomeKind(realm);
  return (
    <RealmPanel
      name={name}
      mark={mark}
      kind={kind}
      level={realm.base.level}
      highest={configManager.getMaxLevel(StructureType.Realm)}
      population={population}
      stores={stores}
      onHome={() => goToPlace(true)}
      {...(own && {
        waiting,
        storeCards,
        onRealms: () => onSurface("realms"),
      })}
    />
  );
};
