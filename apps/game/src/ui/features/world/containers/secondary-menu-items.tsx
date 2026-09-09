import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useTransactionStore } from "@/hooks/store/use-transaction-store";
import { useEventsPanelStore } from "@/ui/features/event-feed/events-panel-store";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { Popover } from "@/ui/design-system/molecules/popover";
import { NetworkStatusPill } from "@/ui/features/world/components/network-status-pill";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";
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

/** The top bar's utility cluster: network status, pending transactions and settings. */
export const SecondaryMenuItems = () => {
  const openPopoverId = usePopoverStore((state) => state.openId);
  const togglePopover = usePopoverStore((state) => state.toggle);
  const txStatus = useTransactionSignal();

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      {/* Connection health indicator - only visible when unhealthy. The
          component returns null when the network is healthy; render it
          directly without a wrapper so it doesn't claim a gap-2 slot when
          empty. */}
      <NetworkStatusPill onRetry={triggerConnectionForceReconnect} />

      <div className="relative">
        <CircleButton
          variant="hud"
          className="transactions-selector"
          tooltipLocation="bottom"
          image="/image-icons/network.png"
          label={"Network and transactions"}
          size="topbar"
          onClick={() => useEventsPanelStore.getState().openEvents("mine")}
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
