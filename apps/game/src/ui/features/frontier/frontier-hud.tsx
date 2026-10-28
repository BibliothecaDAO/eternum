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
import { configManager } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { StructureType } from "@bibliothecadao/types";
import { useLayout } from "@/shell/frame/layout";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { type ComponentProps, type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RealmVisitFoot, useRealmVisitNavigation, useVisitedRealm } from "./board/realm-visit";
import { FrontierSeason, SeasonOver, useSeasonRank } from "./board/season-board";
import { useSpectatorWatch } from "./board/spectator-watch";
import { useExpeditionRules, useFrontierRealm, useGoToFrontierPlace } from "./frontier-home";
import { ArmyRefill } from "./army/army-refill";
import { useArmyPanelOpens, usePickArmy } from "./army/army-opens";
import { FrontierArmy } from "./army/frontier-army";
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
import { useOnePanel } from "./hud/one-panel";
import { FrontierDayClock } from "./hud/day-pill";
import { FrontierNextUp } from "./next-up/frontier-next-up";
import { FrontierStrip, useStoreReadings } from "./hud/frontier-strip";
import { RealmPanel } from "./hud/realm-panel";
import { HudBands } from "./hud/hud-bands";
import { MenuPage } from "./hud/menu-page";
import { FrontierRealms } from "./value/frontier-realms";
import { FrontierWithdraw } from "./value/frontier-withdraw";
import { SeasonWithdraw } from "./value/season-withdraw";
import { LordsPurse, PurseRow, RealmsChip } from "./value/lords-purse";
import { useCampaignMark } from "./value/campaign-home";
import { useRealmLabor } from "./value/use-realm-labor";
import { useRealmLords } from "./value/use-realm-lords";
import { OfflineNotice } from "./hud/offline-notice";
import { SceneFailureNotice } from "./hud/scene-failure-notice";
import { NextOrderBar, OrderBar } from "./hud/order-bar";
import { PickedArmy } from "./hud/picked-army";
import { FrontierToday } from "./log/frontier-today";
import { CARD_STORE_KINDS, type CardStore, FrontierStoreCard, isCardStore } from "./production/frontier-store-card";
import { FrontierResearch } from "./research/frontier-research";
import { ClearedRuinChest } from "./chest/cleared-ruin-chest";
import { dayClock } from "./hud/day-clock";
import { BuildingsInFlight } from "./build/build-sheet";
import { DayDone } from "./rollover/day-done";
import { useRealmPopulation } from "./realm/realm-population";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useDocumentClass } from "@/hooks/use-document-class";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

/**
 * Frontier's HUD, one set of parts in two compositions (the desktop's shared regions, a phone's bands): the realm and
 * its stores, a nav page or the map, Next up, the action bar while an army is selected, the armies and the places.
 * Everything else opens from these as a sheet.
 */
export const FrontierHud = ({ rules }: { rules: ExpeditionRules }) => {
  // Parts shared with the Blitz and Eternum HUD read upright, untracked and in sentence case here (index.css).
  useDocumentClass("frontier-hud");
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const spectating = useUIStore(isWatching);
  const realm = useFrontierRealm();
  // On a visit the dock shows the visited realm's armies; no order renders for a realm the player does not own.
  const visit = useRealmVisit();
  const visited = useVisitedRealm(visit);
  const dockRealm = visit ? visited : realm;
  // The visit's way in and out lives here, above the two layouts, so switching layout replays no visit.
  useRealmVisitNavigation(realm);
  // A spectator watches their own realm when they have one this season, else the leader; the strip reads it.
  useSpectatorWatch();
  // What the map has selected opens its card; the one panel decides which of it, a surface and a deploy order stands.
  // A card's way to Research may name the node it opens on (the castle's own research, a building's gate).
  const [researchPick, setResearchPick] = useState<string | undefined>();
  const card = useSelectionCard({
    realm,
    onResearch: (node) => {
      setResearchPick(node);
      setSurface("research");
    },
    onArmyBack: (armyId) => armyPanel.returnTo(armyId),
  });
  const desktop = useLayout() === "desktop";
  const {
    surface,
    openSurface: setSurface,
    showsCard,
    home,
    goHome,
    feedOpen,
    closeFeed,
  } = useOnePanel(card?.key ?? null, !desktop);
  const realmLabor = useRealmLabor(rules, realm);
  const research = useResearchTree(realm);
  useEffect(() => {
    if (surface !== "research") setResearchPick(undefined);
  }, [surface]);
  // Selecting one of the realm's armies opens its panel; a pick in the dock, Today or Next up goes the same way.
  const [armyChoosing, setArmyChoosing] = useState(false);
  const armyPanel = useArmyPanelOpens(
    visit ? null : realm,
    (choosing) => {
      setArmyChoosing(choosing);
      setSurface("army");
    },
    desktop,
  );
  const openArmy = armyPanel.pick;
  const pickArmy = usePickArmy();
  const seasonRank = useSeasonRank();
  // The store card a ring or a plate opened, under the realm card on a desktop and under the strip on a phone.
  const [openStore, setOpenStore] = useState<CardStore | null>(null);
  const goToPlace = useGoToFrontierPlace(realm);
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
      <FrontierStrip
        rules={rules}
        realm={realm ?? visited}
        onOpenDay={() => setSurface("today")}
        storeCards={storeCards}
      />
      {storeCards?.open && storeCards.card}
    </>
  );
  // A phone's purse: the player's realm's LORDS; a spectator sees there what the desktop's top bar says of them.
  const purse = spectating ? (
    <IdentityChip compact />
  ) : (
    realm &&
    !visit && (
      <RealmPurse
        realm={realm}
        laborWaiting={realmLabor?.plan.total ?? 0}
        onWithdraw={() => setSurface("withdraw")}
        onRealms={() => setSurface("realms")}
      />
    )
  );
  const page =
    surface === "research" && realm ? (
      <FrontierResearch key={researchPick} realm={realm} pick={researchPick} onClose={close} />
    ) : surface === "season" ? (
      <FrontierSeason rules={rules} onVisited={close} onClose={close} />
    ) : surface === "menu" ? (
      <HudMenu realm={realm} laborWaiting={(realmLabor?.plan.total ?? 0) > 0} onOpen={setSurface} onClose={close} />
    ) : undefined;
  const notices = (
    <>
      <ClearedRuinChest />
      <OfflineNotice />
      <SceneFailureNotice />
    </>
  );
  const action = (
    <>
      {dockRealm && !desktop && (
        <ArmyAction rules={rules} realm={dockRealm} onOpenArmy={visit ? undefined : openArmy} />
      )}
      <RealmVisitFoot home={realm} />
    </>
  );
  // A phone's dock picks an army, the map first; a desktop's opens its panel too.
  const dock = dockRealm && <DockFor rules={rules} realm={dockRealm} onOpenArmy={desktop ? openArmy : pickArmy} />;
  const sheets = (
    <>
      <FrontierSurfaces realm={realm} rules={rules} />
      {showsCard && card?.sheet}
      {surface === "withdraw" && realm && !visit && <FrontierWithdraw realm={realm} onClose={close} />}
      {surface === "realms" && realm && !visit && (
        <FrontierRealms
          labor={realmLabor}
          onRealm={() => {
            close();
            goToPlace(false);
          }}
          onClose={close}
        />
      )}
      {surface === "army" && realm && !visit && <FrontierArmy realm={realm} choosing={armyChoosing} onClose={close} />}
      {surface === "settings" && (
        <HudSheet label={SETTINGS} onClose={close}>
          <SettingsPanel />
        </HudSheet>
      )}
      {surface === "today" && (
        <FrontierToday
          rules={rules}
          realm={realm ?? visited}
          onOpenArmy={realm && !visit ? openArmy : undefined}
          onClose={close}
        />
      )}
      {/* The card covers the HUD: the season's board and Withdraw each open in its place. */}
      {surface !== "season" && surface !== "withdraw" && (
        <SeasonOver
          withdraw={realm && !visit && <SeasonWithdraw realm={realm} onOpen={() => setSurface("withdraw")} />}
          onSeason={() => setSurface("season")}
        />
      )}
      {realm && <DayDone rules={rules} realm={realm} visiting={Boolean(visit)} />}
      <BuildingsInFlight />
    </>
  );

  // Next up speaks to a player in their own realm: a visit or a spectator has none.
  const nextUp = realm && !visit && (
    <FrontierNextUp rules={rules} realm={realm} onSurface={setSurface} onOpenArmy={openArmy} />
  );

  return desktop ? (
    <FrontierDesktop
      season={{ rank: seasonRank, onOpen: () => setSurface("season") }}
      clock={<FrontierDayClock rules={rules} onOpenToday={() => setSurface("today")} />}
      realm={
        (realm ?? visited) && (
          <FrontierRealmPanel
            rules={rules}
            realm={(realm ?? visited)!}
            own={own}
            labor={realmLabor?.plan.total ?? 0}
            storeCards={storeCards}
            onSurface={setSurface}
          />
        )
      }
      armies={dock}
      nextUp={nextUp}
      page={page}
      feed={feedOpen && <FrontierFeed onClose={closeFeed} />}
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
            home={home}
            feedOpen={feedOpen}
            onCloseFeed={closeFeed}
            onSurface={setSurface}
            onHome={goHome}
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
      board={dockRealm}
      visiting={visit !== null}
      surface={surface}
      onSurface={setSurface}
      strip={strip}
      purse={purse}
      page={page}
      nextUp={nextUp}
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
  visiting: boolean;
  surface: HudSurface | null;
  onSurface: (surface: HudSurface | null) => void;
  strip: ReactNode;
  purse: ReactNode;
  page: ReactNode;
  nextUp: ReactNode;
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
            gameZoneId={chat.gameZoneId}
            signedIn={chat.initializer !== null}
            onSignIn={chat.requestSignIn}
            pane={chatPane}
          />
        ) : surface === "feed" ? (
          <FrontierFeed onClose={() => onSurface(null)} />
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
 * army picked, the army (a tap opens its card), its four sides, its stamina as its refill, and Level up; otherwise
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
  if (acting && onOpenArmy)
    return (
      <PickedArmy
        army={acting}
        refill={<ArmyRefill army={acting} realm={realm} look="stamina" />}
        onDetails={() => onOpenArmy(acting.explorerId)}
        onLevelUp={() => onOpenArmy(acting.explorerId, acting.canSpendSkillPoint)}
      />
    );
  return null;
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
      refill={<ArmyRefill army={army} realm={realm} />}
      onCancel={() => useUIStore.getState().updateEntityActionHoveredHex(null)}
      onGo={() => requestOrderAt(order.target)}
    />
  );
};

/** The Menu page over the game: each row opens its way and closes the menu; Exit leaves for the app. */
const HudMenu = ({
  realm,
  laborWaiting,
  onOpen,
  onClose,
}: {
  realm: NativeRows["Structure"] | null;
  /** Whether the player's Realms have labor to give today: the Realms row wears a dot. */
  laborWaiting: boolean;
  onOpen: (surface: HudSurface | null) => void;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const rank = useSeasonRank();
  return (
    <MenuPage
      rank={rank}
      onToday={() => onOpen("today")}
      onSeason={() => onOpen("season")}
      realms={realm ? { waiting: laborWaiting, onOpen: () => onOpen("realms") } : undefined}
      onSettings={() => onOpen("settings")}
      onExit={() => navigate("/")}
      onClose={onClose}
    />
  );
};

/**
 * The desktop's realm panel over the realm the HUD reads (the player's, or the one watched or visited): its name and
 * rank's steps in a header that takes the map home to it, its population and stores, and for the player's own realm
 * its LORDS (Withdraw), its Realms' labor (Realms) and each store's card.
 */
const FrontierRealmPanel = ({
  rules,
  realm,
  own,
  labor,
  storeCards,
  onSurface,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  /** The player's own realm, the one read; null while watching or visiting. */
  own: NativeRows["Structure"] | null;
  labor: number;
  storeCards: ComponentProps<typeof RealmPanel>["storeCards"];
  onSurface: (surface: HudSurface) => void;
}) => {
  const name = useGameModeConfig().structure.getName(realm).name;
  const stores = useStoreReadings(realm, rules);
  const lords = useRealmLords(own ?? realm);
  const population = useRealmPopulation(realm);
  const goToPlace = useGoToFrontierPlace(realm);
  const mark = useCampaignMark(realm);
  return (
    <RealmPanel
      name={name}
      mark={mark}
      level={realm.base.level}
      highest={configManager.getMaxLevel(StructureType.Realm)}
      population={population}
      stores={stores}
      onHome={() => goToPlace(true)}
      {...(own && {
        lords,
        labor,
        storeCards,
        onWithdraw: () => onSurface("withdraw"),
        onRealms: () => onSurface("realms"),
      })}
    />
  );
};

/**
 * Under the strip: the realm's LORDS, which open Withdraw, and beside them the Realms chip while the player's Realms
 * have labor to give today.
 */
const RealmPurse = ({
  realm,
  laborWaiting,
  onWithdraw,
  onRealms,
}: {
  realm: NativeRows["Structure"];
  laborWaiting: number;
  onWithdraw: () => void;
  onRealms: () => void;
}) => (
  <PurseRow>
    {laborWaiting > 0 && <RealmsChip labor={laborWaiting} onOpen={onRealms} />}
    <LordsPurse lords={useRealmLords(realm)} onOpen={onWithdraw} />
  </PurseRow>
);
