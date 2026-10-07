import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useRealmVisit } from "@/sync/active-game-client";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { SETTINGS } from "@/ui/design-system/kit/words";
import { EventLogPanel } from "@/ui/features/event-feed/event-log-panel";
import { useGameChat } from "@/ui/features/world/containers/hud-chat-window";
import { SettingsPanel } from "@/ui/modules/settings/settings";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useNavigate } from "react-router-dom";
import { FrontierPick } from "./attributes/frontier-pick";
import { RealmVisitBanner, useVisitedRealm } from "./board/realm-visit-banner";
import { SeasonBoardHost, SeasonBoardPeek, useOpenSeasonBoard, useSeasonRank } from "./board/season-board";
import { useSpectatorWatchesTheLeader } from "./board/spectator-watch";
import { ChestMomentView } from "./chest/chest-moment-view";
import { useChestResults } from "./chest/chest-results";
import { useExpeditionRules, useFrontierRealm } from "./frontier-home";
import { FrontierSelectionSheet } from "./frontier-selection-sheet";
import { FrontierSurfaces } from "./frontier-surfaces";
import { FrontierGuide, useGuideLine } from "./guide/frontier-guide";
import { replayGuide } from "./guide/guide-seen";
import { SelectedArmyBar } from "./hud/action-bar";
import { ArmyDock } from "./hud/army-dock";
import { ChatPage } from "./hud/chat-page";
import { useDockArmies } from "./hud/dock-armies";
import { FrontierNav, type HudSurface, useHudSurface } from "./hud/frontier-nav";
import { FrontierStrip } from "./hud/frontier-strip";
import { HudBands } from "./hud/hud-bands";
import { MenuSheet } from "./hud/menu-sheet";
import { OfflineNotice } from "./hud/offline-notice";
import { TodayCard } from "./log/today-card";
import { FrontierResearch } from "./research/frontier-research";
import { SiteClearCardView } from "./sites/site-clear-card";
import { useFrontierType } from "./use-frontier-type";

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
  useChestResults();
  const [surface, setSurface] = useHudSurface();
  const chat = useGameChat(surface === "chat");
  const guideLine = useGuideLine(rules, realm);
  if (showBlankOverlay) return null;
  const close = () => setSurface(null);

  return (
    <HudBands
      top={<FrontierStrip rules={rules} realm={realm ?? visited} />}
      middle={
        surface === "chat" ? (
          <ChatPage gameZoneId={chat.gameZoneId} signedIn={chat.initializer !== null} onSignIn={chat.requestSignIn} />
        ) : undefined
      }
      foot={
        <>
          <div data-guide>{realm && !visit && <FrontierGuide line={guideLine} realm={realm} />}</div>
          <FrontierPick />
          <SiteClearCardView />
          <OfflineNotice />
          {dockRealm && <Foot realm={dockRealm} />}
          <FrontierNav realm={realm} surface={surface} onSurface={setSurface} unread={chat.unread} />
        </>
      }
    >
      {/* A chest's opening owns the screen while it plays, over the world where the chest opens. */}
      <ChestMomentView />
      <FrontierSurfaces realm={realm} />
      <RealmVisitBanner home={realm} />
      <div className="pointer-events-auto fixed right-2 top-24 hidden lg:block">
        <SeasonBoardPeek />
      </div>
      <FrontierSelectionSheet realm={realm} />
      {surface === "menu" && <HudMenu onOpen={setSurface} onClose={close} />}
      {surface === "research" && realm && <FrontierResearch realm={realm} onClose={close} />}
      {surface === "settings" && (
        <Sheet label={SETTINGS} onClose={close}>
          <SettingsPanel />
        </Sheet>
      )}
      {surface === "today" && (
        <EventLogPanel header={<TodayCard rules={rules} />} onDismiss={close} isInsideAnchor={() => false} />
      )}
      <SeasonBoardHost />
    </HudBands>
  );
};

/** The foot's army rows: the selected army's status, then the dock. */
const Foot = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const armies = useDockArmies(realm);
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const selected = armies.find((army) => army.explorerId === selectedId);
  return (
    <>
      {selected && <SelectedArmyBar army={selected} />}
      <ArmyDock realm={realm} armies={armies} />
    </>
  );
};

/** The Menu over the game: each row opens its way and closes the menu; Exit leaves for the app. */
const HudMenu = ({ onOpen, onClose }: { onOpen: (surface: HudSurface | null) => void; onClose: () => void }) => {
  const navigate = useNavigate();
  const player = useAccountStore((state) => state.account?.address ?? null);
  const openSeasonBoard = useOpenSeasonBoard();
  const rank = useSeasonRank();
  return (
    <MenuSheet
      rank={rank}
      onToday={() => onOpen("today")}
      onSeason={() => {
        onClose();
        openSeasonBoard();
      }}
      onGuide={() => {
        onClose();
        if (player) replayGuide(configManager.getActiveGameId(), player);
      }}
      onSettings={() => onOpen("settings")}
      onExit={() => navigate("/")}
      onClose={onClose}
    />
  );
};
