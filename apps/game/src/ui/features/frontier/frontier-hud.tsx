import { useUIStore } from "@/hooks/store/use-ui-store";
import { useRealmVisit } from "@/sync/active-game-client";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { SETTINGS } from "@/ui/design-system/kit/words";
import { useGameChat } from "@/ui/features/world/containers/hud-chat-window";
import { SettingsPanel } from "@/ui/modules/settings/settings";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useLayout } from "@/shell/frame/layout";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RealmVisitFoot, useVisitedRealm } from "./board/realm-visit";
import { SeasonPeek } from "./board/season-peek";
import { FrontierSeason, SeasonOver, useSeasonRank } from "./board/season-board";
import { useSpectatorWatchesTheLeader } from "./board/spectator-watch";
import { useExpeditionRules, useFrontierRealm } from "./frontier-home";
import { ArmyRefill } from "./army/army-refill";
import { FrontierArmy } from "./army/frontier-army";
import { FrontierSelectionSheet } from "./frontier-selection-sheet";
import { useRealmStores } from "./realm-stores";
import { FrontierSurfaces } from "./frontier-surfaces";
import { GuideProvider, GuideSlot, useGuideSwitch } from "./guide/frontier-guide";
import { SelectedArmyBar, useArmyRevealYield } from "./hud/action-bar";
import { type ArmyOrder, useArmyOrder } from "./hud/army-order";
import { ArmyDock } from "./hud/army-dock";
import { ChatPage } from "./hud/chat-page";
import { type DockArmy, useDockArmies } from "./hud/dock-armies";
import { FrontierNav, type HudSurface, useHudSurface } from "./hud/frontier-nav";
import { FrontierStrip } from "./hud/frontier-strip";
import { HudBands } from "./hud/hud-bands";
import { MenuSheet } from "./hud/menu-sheet";
import { LordsPurse, PurseRow } from "./value/lords-purse";
import { useRealmLords } from "./value/use-realm-lords";
import { OfflineNotice } from "./hud/offline-notice";
import { OrderBar } from "./hud/order-bar";
import { FrontierToday } from "./log/frontier-today";
import { FrontierProduction } from "./production/frontier-production";
import { FrontierResearch } from "./research/frontier-research";
import { SiteClearCardView } from "./sites/site-clear-card";
import { useFrontierType } from "./use-frontier-type";
import { dayClock } from "./hud/day-clock";
import { DayDone } from "./rollover/day-done";
import { RealmBuildingsRow } from "./realm/buildings-row";
import { LastHourBubble } from "./rollover/last-hour";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

/**
 * Frontier's HUD, one set of parts in two compositions (HudBands): the strip with its clock line, a nav page or the
 * map, the guide when it speaks, the action bar while an army is selected, the dock and the place bar; on desktop also
 * the season's top five and chat docked open. Everything else opens from these as a sheet.
 */
export const FrontierHud = ({ rules }: { rules: ExpeditionRules }) => {
  useFrontierType();
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const realm = useFrontierRealm();
  // On a visit the dock shows the visited realm's armies; no order renders for a realm the player does not own.
  const visit = useRealmVisit();
  const visited = useVisitedRealm(visit);
  const dockRealm = visit ? visited : realm;
  // A spectator has no realm of their own: they watch the season's leader, and the strip reads the watched realm.
  useSpectatorWatchesTheLeader();
  const [surface, setSurface] = useHudSurface();
  const desktop = useLayout() === "desktop";
  // Desktop keeps chat docked open beside the map, its Chat slot collapsing it; a phone opens it as a page.
  const [chatDocked, setChatDocked] = useState(true);
  const chat = useGameChat(desktop ? chatDocked : surface === "chat");
  if (showBlankOverlay) return null;
  const close = () => setSurface(null);
  const onSurface = (next: HudSurface | null) =>
    desktop && (next === "chat" || (next === null && surface === "chat"))
      ? setChatDocked((docked) => !docked)
      : setSurface(next);
  const chatPage = (
    <ChatPage gameZoneId={chat.gameZoneId} signedIn={chat.initializer !== null} onSignIn={chat.requestSignIn} />
  );
  const openArmy = (explorerId: number) => {
    useUIStore.getState().updateEntityActionSelectedEntityId(explorerId);
    setSurface("army");
  };

  return (
    <GuideProvider rules={rules} realm={visit ? null : realm}>
      <HudBands
        strip={
          <>
            <FrontierStrip
              rules={rules}
              realm={realm ?? visited}
              onOpenStores={realm && !visit ? () => setSurface("production") : undefined}
            />
            {realm && !visit && <RealmPurse realm={realm} />}
          </>
        }
        page={
          surface === "chat" && !desktop ? (
            chatPage
          ) : surface === "research" && realm ? (
            <FrontierResearch rules={rules} realm={realm} />
          ) : surface === "season" ? (
            <FrontierSeason rules={rules} onBack={close} />
          ) : undefined
        }
        stage={dockRealm && !visit && <LastHour rules={rules} realm={dockRealm} />}
        guide={<GuideSlot host="foot" />}
        notices={
          <>
            <SiteClearCardView />
            <OfflineNotice />
          </>
        }
        action={
          <>
            {dockRealm && <ArmyAction rules={rules} realm={dockRealm} onOpenArmy={() => setSurface("army")} />}
            <RealmVisitFoot home={realm} />
          </>
        }
        dock={dockRealm && <DockFor realm={dockRealm} />}
        nav={
          // A player's visit trades the nav for its Leave; a spectator, with no realm to go back to, keeps it.
          !(visit && realm) && (
            <FrontierNav
              rules={rules}
              realm={realm}
              board={dockRealm}
              surface={surface}
              onSurface={onSurface}
              unread={chat.unread}
            />
          )
        }
        peek={<SeasonPeek onOpen={() => setSurface("season")} />}
        chat={desktop && chatDocked && chatPage}
      >
        <FrontierSurfaces realm={realm} />
        <FrontierSelectionSheet rules={rules} realm={realm} />
        {surface === "menu" && <HudMenu realm={realm} onOpen={setSurface} onClose={close} />}
        {surface === "army" && realm && !visit && <FrontierArmy realm={realm} onClose={close} />}
        {surface === "production" && realm && <FrontierProduction rules={rules} realm={realm} onClose={close} />}
        {surface === "settings" && (
          <Sheet label={SETTINGS} onClose={close}>
            <SettingsPanel />
          </Sheet>
        )}
        {surface === "today" && <FrontierToday rules={rules} realm={realm} onOpenArmy={openArmy} onClose={close} />}
        {surface !== "season" && <SeasonOver onSeason={() => setSurface("season")} />}
        {realm && !visit && <DayDone rules={rules} realm={realm} />}
      </HudBands>
    </GuideProvider>
  );
};

/**
 * The action bar's army row: with an order pending, its costs and verb; otherwise the selected army's status, a tap
 * opening the army. A full realm's phone board adds its Buildings row.
 */
const ArmyAction = ({
  rules,
  realm,
  onOpenArmy,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  onOpenArmy: () => void;
}) => {
  const armies = useDockArmies(realm);
  const order = useArmyOrder();
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const selected = armies.find((army) => army.explorerId === selectedId);
  if (order && selected) return <PendingOrder rules={rules} realm={realm} order={order} army={selected} />;
  return (
    <>
      <RealmBuildingsRow realm={realm} />
      {selected && <SelectedArmyBar army={selected} onOpen={onOpenArmy} />}
    </>
  );
};

/** The dock over the realm's armies today; on a phone a pending order takes the foot in its place. */
const DockFor = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const armies = useDockArmies(realm);
  const order = useArmyOrder();
  const selected = useUIStore((state) => state.entityActions.selectedEntityId !== null);
  const phone = useLayout() === "phone";
  if (phone && order && selected) return null;
  return <ArmyDock realm={realm} armies={armies} />;
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
  onOpen,
  onClose,
}: {
  realm: NativeRows["Structure"] | null;
  onOpen: (surface: HudSurface | null) => void;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const guide = useGuideSwitch();
  const rank = useSeasonRank();
  return (
    <MenuSheet
      rank={rank}
      onToday={() => onOpen("today")}
      onProduction={realm ? () => onOpen("production") : null}
      onSeason={() => onOpen("season")}
      guide={
        guide && {
          on: guide.on,
          onToggle: () => {
            onClose();
            guide.toggle();
          },
        }
      }
      onSettings={() => onOpen("settings")}
      onExit={() => navigate("/")}
      onClose={onClose}
    />
  );
};

/**
 * The realm's LORDS under the strip. Withdraw and the Realms chip join it when their facts are served (the value
 * relay's claims and the held Realms); until then they live in the lab only, so nothing unwired reaches a player.
 */
const RealmPurse = ({ realm }: { realm: NativeRows["Structure"] }) => (
  <PurseRow>
    <LordsPurse lords={useRealmLords(realm)} />
  </PurseRow>
);
