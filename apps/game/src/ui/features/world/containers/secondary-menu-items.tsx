import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useTransactionStore } from "@/hooks/store/use-transaction-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { useLatestFeaturesSeen } from "@/hooks/use-latest-features-seen";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { Popover } from "@/ui/design-system/molecules/popover";
import { NetworkStatusPill } from "@/ui/features/world/components/network-status-pill";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";
import { LEADERBOARD_POPOVER_ID, SocialBoard } from "@/ui/features/social/components/social-board";
import { latestFeatures, rewards, transactions } from "@/ui/features/world";
import { SETTINGS_POPOVER_ID, SettingsPanel } from "@/ui/modules/settings/settings";

import { useDojo } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";

import { useMemo } from "react";
import { gameEntityKey } from "@/sync/game-scope";

/** The top bar's utility cluster: rewards, latest features, network, transactions and settings. */
export const SecondaryMenuItems = () => {
  const {
    setup: {
      components: { GameRegistry },
    },
  } = useDojo();

  // Legacy worlds emit a SeasonEnded event (the bridge keeps it in the seasonEnded
  // slice); the s2 single world flips the active game's registry status instead.
  const hasSeasonEndedEvent = useWorldSlicesStore((state) => state.seasonEnded !== null);
  const gameRegistry = useComponentValue(
    GameRegistry,
    useMemo(() => gameEntityKey([]), []),
  );
  const registryStatus = gameRegistry ? String(gameRegistry.status) : "";
  const hasSeasonEnded = hasSeasonEndedEvent || registryStatus === "Ended" || registryStatus === "Settled";

  const { unseenCount: unseenFeaturesCount } = useLatestFeaturesSeen();

  const togglePopup = useUIStore((state) => state.togglePopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const isLeaderboardOpen = usePopoverStore((state) => state.openId === LEADERBOARD_POPOVER_ID);
  const isSettingsOpen = usePopoverStore((state) => state.openId === SETTINGS_POPOVER_ID);
  const togglePopover = usePopoverStore((state) => state.toggle);

  // Transaction status for the network button indicator
  const txTransactions = useTransactionStore((state) => state.transactions);
  const txStuckThresholdMs = useTransactionStore((state) => state.stuckThresholdMs);

  const txStatus = useMemo(() => {
    const now = Date.now();
    const pending = txTransactions.filter((t) => t.status === "pending");
    const stuck = pending.filter((t) => now - t.submittedAt >= txStuckThresholdMs);
    const recentReverted = txTransactions.some(
      (t) => t.status === "reverted" && t.confirmedAt && now - t.confirmedAt < 60_000,
    );

    let status: "idle" | "pending" | "stuck" | "error" = "idle";
    if (recentReverted) status = "error";
    else if (stuck.length > 0) status = "stuck";
    else if (pending.length > 0) status = "pending";

    return {
      status,
      pendingCount: pending.length,
      notificationColor:
        status === "error" ? "red" : status === "stuck" ? "orange" : status === "pending" ? "gold" : undefined,
    };
  }, [txTransactions, txStuckThresholdMs]);

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      {/* Leaderboard keeps its own button; the social board hangs off it. */}
      <Popover
        id={LEADERBOARD_POPOVER_ID}
        ariaLabel="Leaderboard"
        align="end"
        className="w-auto"
        trigger={
          <CircleButton
            variant="hud"
            className="social-selector"
            tooltipLocation="bottom"
            active={isLeaderboardOpen}
            image={BuildingThumbs.guild}
            label={"Leaderboard"}
            size="topbar"
            onClick={() => togglePopover(LEADERBOARD_POPOVER_ID)}
          />
        }
      >
        <SocialBoard />
      </Popover>

      {/* End-of-season rewards stay surfaced while the season has ended. */}
      {hasSeasonEnded && (
        <CircleButton
          variant="hud"
          tooltipLocation="bottom"
          image={BuildingThumbs.rewards}
          label={rewards}
          active={isPopupOpen(rewards)}
          size="topbar"
          onClick={() => togglePopup(rewards)}
        />
      )}

      {/* Latest Features — render only while there are unseen features. */}
      {unseenFeaturesCount > 0 && (
        <CircleButton
          variant="hud"
          className="latest-features-selector"
          tooltipLocation="bottom"
          active={isPopupOpen(latestFeatures)}
          image={BuildingThumbs.latestUpdates}
          label={"Latest Features"}
          size="topbar"
          onClick={() => togglePopup(latestFeatures)}
          primaryNotification={{
            value: unseenFeaturesCount,
            color: "gold",
            location: "topright",
          }}
        />
      )}

      {/* Connection health indicator - only visible when unhealthy. The
          component returns null when the network is healthy; render it
          directly without a wrapper so it doesn't claim a gap-2 slot when
          empty. */}
      <NetworkStatusPill onRetry={triggerConnectionForceReconnect} />

      {/* Transactions — always visible, sits immediately to the left of Settings.
          Status dot indicator overlays when there's an active signal. */}
      <div className="relative">
        <CircleButton
          variant="hud"
          className="transactions-selector"
          tooltipLocation="bottom"
          active={isPopupOpen(transactions)}
          image="/image-icons/network.png"
          label={"Transactions"}
          size="topbar"
          onClick={() => togglePopup(transactions)}
          primaryNotification={
            txStatus.pendingCount > 0
              ? {
                  value: txStatus.pendingCount,
                  color: txStatus.notificationColor as "green" | "red" | "orange" | "gold",
                  location: "topright",
                }
              : undefined
          }
        />
        {txStatus.status !== "idle" && (
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-dark-brown
                        ${txStatus.status === "pending" ? "bg-gold animate-pulse" : ""}
                        ${txStatus.status === "stuck" ? "bg-orange animate-pulse" : ""}
                        ${txStatus.status === "error" ? "bg-danger" : ""}
                        shadow-[0_0_6px_currentColor]`}
          />
        )}
      </div>

      {/* Settings stays last in the utility cluster; its panel hangs off the gear. */}
      <Popover
        id={SETTINGS_POPOVER_ID}
        ariaLabel="Settings"
        align="end"
        className="w-[420px] overflow-y-auto"
        trigger={
          <CircleButton
            variant="hud"
            className="settings-selector"
            tooltipLocation="bottom"
            active={isSettingsOpen}
            image={BuildingThumbs.settings}
            label={"Settings"}
            size="topbar"
            onClick={() => togglePopover(SETTINGS_POPOVER_ID)}
          />
        }
      >
        <SettingsPanel />
      </Popover>
    </div>
  );
};
