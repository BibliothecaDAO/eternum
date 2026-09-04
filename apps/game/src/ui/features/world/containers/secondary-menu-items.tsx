import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useTransactionStore } from "@/hooks/store/use-transaction-store";
import { useLatestFeaturesSeen } from "@/hooks/use-latest-features-seen";
import { EventFeedPanel, FEED_POPOVER_ID } from "@/ui/features/event-feed/event-feed-panel";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { Popover } from "@/ui/design-system/molecules/popover";
import { LEADERBOARD_POPOVER_ID, SocialBoard } from "@/ui/features/social/components/social-board";
import { NetworkStatusPill } from "@/ui/features/world/components/network-status-pill";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";
import { LATEST_FEATURES_POPOVER_ID, LatestFeaturesPanel } from "@/ui/modules/latest-features/latest-features";
import { SETTINGS_POPOVER_ID, SettingsPanel } from "@/ui/modules/settings/settings";
import { useMemo } from "react";

type TransactionSignal = "idle" | "pending" | "stuck" | "error";

/** The transactions button's indicator: pending count plus the loudest live signal. */
const useTransactionSignal = () => {
  const txTransactions = useTransactionStore((state) => state.transactions);
  const txStuckThresholdMs = useTransactionStore((state) => state.stuckThresholdMs);

  return useMemo(() => {
    const now = Date.now();
    const pending = txTransactions.filter((t) => t.status === "pending");
    const stuck = pending.filter((t) => now - t.submittedAt >= txStuckThresholdMs);
    const recentReverted = txTransactions.some(
      (t) => t.status === "reverted" && t.confirmedAt && now - t.confirmedAt < 60_000,
    );

    let status: TransactionSignal = "idle";
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
};

/** The top bar's utility cluster: leaderboard, what's new, network, transactions and settings, each a popover off its button. */
export const SecondaryMenuItems = () => {
  const openPopoverId = usePopoverStore((state) => state.openId);
  const togglePopover = usePopoverStore((state) => state.toggle);
  const { unseenCount: unseenFeaturesCount } = useLatestFeaturesSeen();
  const txStatus = useTransactionSignal();
  const isLatestFeaturesOpen = openPopoverId === LATEST_FEATURES_POPOVER_ID;

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
            active={openPopoverId === LEADERBOARD_POPOVER_ID}
            image={BuildingThumbs.guild}
            label={"Leaderboard"}
            size="topbar"
            onClick={() => togglePopover(LEADERBOARD_POPOVER_ID)}
          />
        }
      >
        <SocialBoard />
      </Popover>

      {/* What's new — the button shows while there are unseen features, and stays while its feed is open
          (opening the feed marks it seen). */}
      {(unseenFeaturesCount > 0 || isLatestFeaturesOpen) && (
        <Popover
          id={LATEST_FEATURES_POPOVER_ID}
          ariaLabel="What's new"
          align="end"
          className="w-[420px] overflow-y-auto p-0"
          trigger={
            <CircleButton
              variant="hud"
              className="latest-features-selector"
              tooltipLocation="bottom"
              active={isLatestFeaturesOpen}
              image={BuildingThumbs.latestUpdates}
              label={"Latest Features"}
              size="topbar"
              onClick={() => togglePopover(LATEST_FEATURES_POPOVER_ID)}
              primaryNotification={
                unseenFeaturesCount > 0
                  ? {
                      value: unseenFeaturesCount,
                      color: "gold",
                      location: "topright",
                    }
                  : undefined
              }
            />
          }
        >
          <LatestFeaturesPanel />
        </Popover>
      )}

      {/* Connection health indicator - only visible when unhealthy. The
          component returns null when the network is healthy; render it
          directly without a wrapper so it doesn't claim a gap-2 slot when
          empty. */}
      <NetworkStatusPill onRetry={triggerConnectionForceReconnect} />

      {/* Activity — the event feed, always visible, immediately to the left of Settings.
          Status dot indicator overlays when there's an active signal. */}
      <Popover
        id={FEED_POPOVER_ID}
        ariaLabel="Activity"
        align="end"
        className="w-[360px] overflow-y-auto p-0"
        trigger={
          <div className="relative">
            <CircleButton
              variant="hud"
              className="transactions-selector"
              tooltipLocation="bottom"
              active={openPopoverId === FEED_POPOVER_ID}
              image="/image-icons/network.png"
              label={"Activity"}
              size="topbar"
              onClick={() => togglePopover(FEED_POPOVER_ID)}
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
        }
      >
        <EventFeedPanel />
      </Popover>

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
            active={openPopoverId === SETTINGS_POPOVER_ID}
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
