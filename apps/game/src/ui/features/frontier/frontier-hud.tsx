import { useUIStore } from "@/hooks/store/use-ui-store";
import { useRealmVisit } from "@/sync/active-game-client";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { SETTINGS } from "@/ui/design-system/kit/words";
import { useGameChat } from "@/ui/features/world/containers/hud-chat-window";
import { SettingsPanel } from "@/ui/modules/settings/settings";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useNavigate } from "react-router-dom";
import { RealmVisitFoot, useVisitedRealm } from "./board/realm-visit";
import { FrontierSeason, SeasonOver, useSeasonRank } from "./board/season-board";
import { useSpectatorWatchesTheLeader } from "./board/spectator-watch";
import { useExpeditionRules, useFrontierRealm } from "./frontier-home";
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
 * Frontier's HUD in three bands: the strip with its clock line on top; the map (or a nav page) in the middle; at the
 * foot the guide when it speaks, the action bar while an army is selected, the dock and the place bar. Everything else
 * opens from these as a sheet.
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
  const chat = useGameChat(surface === "chat");
  if (showBlankOverlay) return null;
  const close = () => setSurface(null);

  return (
    <GuideProvider rules={rules} realm={visit ? null : realm}>
      <HudBands
        top={
          <FrontierStrip
            rules={rules}
            realm={realm ?? visited}
            onOpenStores={realm && !visit ? () => setSurface("production") : undefined}
          />
        }
        middle={
          surface === "chat" ? (
            <ChatPage gameZoneId={chat.gameZoneId} signedIn={chat.initializer !== null} onSignIn={chat.requestSignIn} />
          ) : surface === "research" && realm ? (
            <FrontierResearch realm={realm} />
          ) : surface === "season" ? (
            <FrontierSeason onBack={close} />
          ) : (
            <div className="relative min-h-0 flex-1">
              {dockRealm && !visit && <LastHour rules={rules} realm={dockRealm} />}
            </div>
          )
        }
        foot={
          <>
            <div data-guide>
              <GuideSlot host="foot" />
            </div>
            <SiteClearCardView />
            <OfflineNotice />
            {dockRealm && <Foot rules={rules} realm={dockRealm} onOpenArmy={() => setSurface("army")} />}
            <RealmVisitFoot home={realm} />
            {!visit && (
              <FrontierNav rules={rules} realm={realm} surface={surface} onSurface={setSurface} unread={chat.unread} />
            )}
          </>
        }
      >
        <FrontierSurfaces realm={realm} />
        <FrontierSelectionSheet realm={realm} />
        {surface === "menu" && <HudMenu onOpen={setSurface} onClose={close} />}
        {surface === "army" && realm && !visit && <FrontierArmy realm={realm} onClose={close} />}
        {surface === "production" && realm && <FrontierProduction rules={rules} realm={realm} onClose={close} />}
        {surface === "settings" && (
          <Sheet label={SETTINGS} onClose={close}>
            <SettingsPanel />
          </Sheet>
        )}
        {surface === "today" && <FrontierToday rules={rules} onClose={close} />}
        {surface !== "season" && <SeasonOver onSeason={() => setSurface("season")} />}
        {realm && !visit && <DayDone rules={rules} realm={realm} />}
      </HudBands>
    </GuideProvider>
  );
};

/**
 * The foot's army rows: with an order pending, its costs and verb take the foot; otherwise the selected army's status
 * over the dock.
 */
const Foot = ({
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
      <ArmyDock realm={realm} armies={armies} />
    </>
  );
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

/** In the day's last hour, the bubble of what the day's end takes and returns: the troops still out. */
const LastHour = ({ rules, realm }: { rules: ExpeditionRules; realm: NativeRows["Structure"] }) => {
  const armies = useDockArmies(realm);
  const clock = dayClock(rules, useNowSeconds());
  if (clock.tone !== "ember" || armies.length === 0) return null;
  return <LastHourBubble troopsOut={armies.reduce((sum, army) => sum + army.troops, 0)} />;
};

/** The Menu over the game: each row opens its way and closes the menu; Exit leaves for the app. */
const HudMenu = ({ onOpen, onClose }: { onOpen: (surface: HudSurface | null) => void; onClose: () => void }) => {
  const navigate = useNavigate();
  const guide = useGuideSwitch();
  const rank = useSeasonRank();
  return (
    <MenuSheet
      rank={rank}
      onToday={() => onOpen("today")}
      onProduction={() => onOpen("production")}
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
