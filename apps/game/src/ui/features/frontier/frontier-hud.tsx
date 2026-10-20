import { useUIStore } from "@/hooks/store/use-ui-store";
import { useRealmVisit } from "@/sync/active-game-client";
import { dropNextOrder } from "@/three/scenes/worldmap-next-order";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { HudSheet } from "@/ui/design-system/kit/hud-elements";
import { SETTINGS } from "@/ui/design-system/kit/words";
import { useGameChat } from "@/ui/features/world/containers/hud-chat-window";
import { SettingsPanel } from "@/ui/modules/settings/settings";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useLayout } from "@/shell/frame/layout";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { RealmVisitFoot, useVisitedRealm } from "./board/realm-visit";
import { FrontierSeason, SeasonOver, useSeasonRank } from "./board/season-board";
import { useSpectatorWatchesTheLeader } from "./board/spectator-watch";
import { useExpeditionRules, useFrontierRealm } from "./frontier-home";
import { ArmyRefill } from "./army/army-refill";
import { FrontierArmy } from "./army/frontier-army";
import { FrontierSelectionSheet } from "./frontier-selection-sheet";
import { useRealmStores } from "./realm-stores";
import { FrontierSurfaces } from "./frontier-surfaces";
import { SelectedArmyBar, useArmyRevealYield } from "./hud/action-bar";
import { type ArmyOrder, useArmyOrder } from "./hud/army-order";
import { ArmyDock } from "./hud/army-dock";
import { useChatKey } from "./hud/chat-key";
import { FrontierDesktop, FrontierPlaces } from "./hud/frontier-desktop";
import { canResearchNow } from "./research/research-plan";
import { useResearchPlan } from "./research/research-reader";
import { ChatPage } from "./hud/chat-page";
import { type DockArmy, useDockArmies } from "./hud/dock-armies";
import { FrontierNav, type HudSurface, useHudSurface } from "./hud/frontier-nav";
import { FrontierDayClock } from "./hud/day-pill";
import { FrontierNextUp } from "./next-up/frontier-next-up";
import { FrontierStrip, useStoreReadings } from "./hud/frontier-strip";
import { RealmPanel } from "./hud/realm-panel";
import { HudBands } from "./hud/hud-bands";
import { MenuSheet } from "./hud/menu-sheet";
import { FrontierRealms } from "./value/frontier-realms";
import { FrontierWithdraw } from "./value/frontier-withdraw";
import { SeasonWithdraw } from "./value/season-withdraw";
import { LordsPurse, PurseRow, RealmsChip } from "./value/lords-purse";
import { useRealmLabor } from "./value/use-realm-labor";
import { useRealmLords } from "./value/use-realm-lords";
import { OfflineNotice } from "./hud/offline-notice";
import { SceneFailureNotice } from "./hud/scene-failure-notice";
import { NextOrderBar, OrderBar } from "./hud/order-bar";
import { FrontierToday } from "./log/frontier-today";
import { FrontierProduction } from "./production/frontier-production";
import { FrontierResearch } from "./research/frontier-research";
import { ClearedRuinChest } from "./chest/cleared-ruin-chest";
import { dayClock } from "./hud/day-clock";
import { BuildingsInFlight } from "./build/build-sheet";
import { DayDone } from "./rollover/day-done";
import { RealmBuildingsRow } from "./realm/buildings-row";
import { useRealmPopulation } from "./realm/realm-population";
import { LastHourBubble } from "./rollover/last-hour";
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
  const realm = useFrontierRealm();
  // On a visit the dock shows the visited realm's armies; no order renders for a realm the player does not own.
  const visit = useRealmVisit();
  const visited = useVisitedRealm(visit);
  const dockRealm = visit ? visited : realm;
  // A spectator has no realm of their own: they watch the season's leader, and the strip reads the watched realm.
  useSpectatorWatchesTheLeader();
  const [surface, setSurface] = useHudSurface();
  const realmLabor = useRealmLabor(rules, realm);
  const desktop = useLayout() === "desktop";
  const researchPlan = useResearchPlan(realm);
  const seasonRank = useSeasonRank();
  if (showBlankOverlay) return null;
  const close = () => setSurface(null);
  const openArmy = (explorerId: number) => {
    // The army opens on its HUD surface, not on a tile card.
    useUIStore.getState().selectOnMap({ kind: "army", entityId: explorerId, tile: null });
    setSurface("army");
  };

  const strip = (
    <FrontierStrip
      rules={rules}
      realm={realm ?? visited}
      onOpenStores={realm && !visit ? () => setSurface("production") : undefined}
    />
  );
  const purse = realm && !visit && (
    <RealmPurse
      realm={realm}
      laborWaiting={realmLabor?.plan.total ?? 0}
      onWithdraw={() => setSurface("withdraw")}
      onRealms={() => setSurface("realms")}
    />
  );
  const page =
    surface === "research" && realm ? (
      <FrontierResearch rules={rules} realm={realm} />
    ) : surface === "season" ? (
      <FrontierSeason rules={rules} onBack={close} />
    ) : undefined;
  const stage = dockRealm && !visit && <LastHour rules={rules} realm={dockRealm} />;
  const notices = (
    <>
      <ClearedRuinChest />
      <OfflineNotice />
      <SceneFailureNotice />
    </>
  );
  const action = (
    <>
      {dockRealm && (
        <ArmyAction rules={rules} realm={dockRealm} desktop={desktop} onOpenArmy={() => setSurface("army")} />
      )}
      <RealmVisitFoot home={realm} />
    </>
  );
  const dock = dockRealm && <DockFor realm={dockRealm} onOpenArmy={openArmy} />;
  const sheets = (
    <>
      <FrontierSurfaces realm={realm} />
      <FrontierSelectionSheet rules={rules} realm={realm} onResearch={() => setSurface("research")} />
      {surface === "menu" && (
        <HudMenu realm={realm} laborWaiting={(realmLabor?.plan.total ?? 0) > 0} onOpen={setSurface} onClose={close} />
      )}
      {surface === "withdraw" && realm && !visit && <FrontierWithdraw realm={realm} onClose={close} />}
      {surface === "realms" && realm && !visit && (
        <FrontierRealms labor={realmLabor} onRealm={() => setSurface("production")} onClose={close} />
      )}
      {surface === "army" && realm && !visit && <FrontierArmy realm={realm} onClose={close} />}
      {surface === "production" && realm && <FrontierProduction rules={rules} realm={realm} onClose={close} />}
      {surface === "settings" && (
        <HudSheet label={SETTINGS} onClose={close}>
          <SettingsPanel />
        </HudSheet>
      )}
      {surface === "today" && <FrontierToday rules={rules} realm={realm} onOpenArmy={openArmy} onClose={close} />}
      {/* The card covers the HUD: the season's board and Withdraw each open in its place. */}
      {surface !== "season" && surface !== "withdraw" && (
        <SeasonOver
          withdraw={realm && !visit && <SeasonWithdraw realm={realm} onOpen={() => setSurface("withdraw")} />}
          onSeason={() => setSurface("season")}
        />
      )}
      {realm && !visit && <DayDone rules={rules} realm={realm} />}
      <BuildingsInFlight />
    </>
  );

  // Next up speaks to a player in their own realm: a visit or a spectator has none.
  const nextUp = realm && !visit && <FrontierNextUp rules={rules} realm={realm} onSurface={setSurface} />;

  return desktop ? (
    <FrontierDesktop
      season={{ rank: seasonRank, onOpen: () => setSurface("season") }}
      clock={<FrontierDayClock rules={rules} />}
      realm={
        (realm ?? visited) && (
          <FrontierRealmPanel
            rules={rules}
            realm={(realm ?? visited)!}
            own={realm && !visit ? realm : null}
            labor={realmLabor?.plan.total ?? 0}
            onSurface={setSurface}
          />
        )
      }
      armies={dock}
      nextUp={nextUp}
      page={page}
      stage={stage}
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
            research={realm ? canResearchNow(researchPlan) : undefined}
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
      stage={stage}
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
 * composition holds the chat's lifecycle once, and moving between them hands it over whole.
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
  stage: ReactNode;
  nextUp: ReactNode;
  notices: ReactNode;
  action: ReactNode;
  dock: ReactNode;
  children: ReactNode;
}) => {
  const chat = useGameChat(surface === "chat");
  const chatPane = useChatKey(() => onSurface("chat"));
  // A nav page starts right under the strip, where the purse hangs: the purse waits while one is open.
  const pageOpen = surface === "chat" || surface === "research" || surface === "season";
  return (
    <HudBands
      {...bands}
      strip={
        <>
          {strip}
          {!pageOpen && purse}
        </>
      }
      page={
        surface === "chat" ? (
          <ChatPage
            gameZoneId={chat.gameZoneId}
            signedIn={chat.initializer !== null}
            onSignIn={chat.requestSignIn}
            pane={chatPane}
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
 * The action bar's army row: on a phone, with an order pending, its costs and verb; otherwise the selected army's
 * status, a tap opening the army. A full realm's phone board adds its Buildings row. A desktop shows the status alone:
 * its orders go from the map.
 */
const ArmyAction = ({
  rules,
  realm,
  desktop,
  onOpenArmy,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  /** A desktop orders from the map itself, as Blitz does: no order bar, the selected army's state alone. */
  desktop: boolean;
  onOpenArmy: () => void;
}) => {
  const armies = useDockArmies(realm);
  const order = useArmyOrder();
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const nextOrder = useUIStore((state) => state.entityActions.nextOrder);
  const selected = armies.find((army) => army.explorerId === selectedId);
  if (desktop) return selected ? <SelectedArmyBar army={selected} onOpen={onOpenArmy} /> : null;
  if (order && selected) return <PendingOrder rules={rules} realm={realm} order={order} army={selected} />;
  if (selected && nextOrder?.entityId === selected.explorerId)
    return <NextOrderBar onCancel={() => dropNextOrder("cancelled", selected.explorerId)} />;
  return (
    <>
      <RealmBuildingsRow realm={realm} />
      {selected && <SelectedArmyBar army={selected} onOpen={onOpenArmy} />}
    </>
  );
};

/** The dock over the realm's armies today; on a phone a pending order takes the foot in its place. */
const DockFor = ({
  realm,
  onOpenArmy,
}: {
  realm: NativeRows["Structure"];
  onOpenArmy: (explorerId: number) => void;
}) => {
  const armies = useDockArmies(realm);
  const order = useArmyOrder();
  const selected = useUIStore((state) => state.entityActions.selectedEntityId !== null);
  const phone = useLayout() === "phone";
  if (phone && order && selected) return null;
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

/**
 * In the day's last hour, the bubble of what the day's end takes and returns: the troops still out, what their
 * Homecoming returns, and the armies that can still buy a tier.
 */
const LastHour = ({ rules, realm }: { rules: ExpeditionRules; realm: NativeRows["Structure"] }) => {
  const armies = useDockArmies(realm);
  const clock = dayClock(rules, useNowSeconds());
  if (clock.tone !== "ember" || armies.length === 0) return null;
  const returns = armies.map(({ returnsHome }) => returnsHome);
  return (
    <LastHourBubble
      troopsOut={armies.reduce((sum, army) => sum + army.troops, 0)}
      returned={returns.every((back) => back !== undefined) ? returns.reduce((sum, back) => sum + back!, 0) : undefined}
      tiersToBuy={armies.filter(({ canBuyTier }) => canBuyTier).length}
    />
  );
};

/** The Menu over the game: each row opens its way and closes the menu; Exit leaves for the app. */
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
    <MenuSheet
      rank={rank}
      onToday={() => onOpen("today")}
      onProduction={realm ? () => onOpen("production") : null}
      onSeason={() => onOpen("season")}
      realms={realm ? { waiting: laborWaiting, onOpen: () => onOpen("realms") } : undefined}
      onSettings={() => onOpen("settings")}
      onExit={() => navigate("/")}
      onClose={onClose}
    />
  );
};

/**
 * The desktop's realm panel over the realm the HUD reads (the player's, or the one watched or visited): its name, rank,
 * population and stores, and for the player's own realm its LORDS (Withdraw), its Realms' labor (Realms) and Production.
 */
const FrontierRealmPanel = ({
  rules,
  realm,
  own,
  labor,
  onSurface,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  /** The player's own realm, the one read; null while watching or visiting. */
  own: NativeRows["Structure"] | null;
  labor: number;
  onSurface: (surface: HudSurface) => void;
}) => {
  const name = useGameModeConfig().structure.getName(realm).name;
  const stores = useStoreReadings(realm, rules);
  const lords = useRealmLords(own ?? realm);
  const population = useRealmPopulation(realm);
  return (
    <RealmPanel
      name={name}
      level={realm.base.level}
      population={population}
      stores={stores}
      {...(own && {
        lords,
        labor,
        onOpenStores: () => onSurface("production"),
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
