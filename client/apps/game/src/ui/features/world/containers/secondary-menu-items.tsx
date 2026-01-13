import { useAccountStore } from "@/hooks/store/use-account-store";
import { useTransactionStore } from "@/hooks/store/use-transaction-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { latestFeatures, leaderboard, rewards, settings, shortcuts, transactions } from "@/ui/features/world";
import { Controller } from "@/ui/modules/controller/controller";
import { HomeButton } from "@/ui/shared/components/home-button";
import { useDojo } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { Has } from "@dojoengine/recs";

import { useCallback, useMemo } from "react";

export const SecondaryMenuItems = () => {
  const {
    setup: {
      components: {
        events: { SeasonEnded },
      },
    },
  } = useDojo();

  const { connector } = useAccountStore((state) => state);

  const hasSeasonEnded = useEntityQuery([Has(SeasonEnded)]).length > 0;

  const togglePopup = useUIStore((state) => state.togglePopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

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
      notificationColor: status === "error" ? "red" : status === "stuck" ? "orange" : status === "pending" ? "gold" : undefined,
    };
  }, [txTransactions, txStuckThresholdMs]);

  const handleTrophyClick = useCallback(() => {
    if (!connector?.controller) {
      console.error("Connector not initialized");

      return;
    }
    connector.controller.openProfile("trophies");
  }, [connector]);

  // For leaderboard + (optionally) rewards, preserve current logic
  const leaderboardButtons = useMemo(() => {
    const buttons = [
      {
        button: (
          <CircleButton
            className="social-selector border-none"
            tooltipLocation="bottom"
            image={BuildingThumbs.guild}
            label={leaderboard}
            active={isPopupOpen(leaderboard)}
            size="md"
            onClick={() => togglePopup(leaderboard)}
          />
        ),
      },
    ];
    if (hasSeasonEnded) {
      buttons.push({
        button: (
          <CircleButton
            tooltipLocation="bottom"
            image={BuildingThumbs.rewards}
            label={rewards}
            active={isPopupOpen(rewards)}
            size="md"
            className="border-none"
            onClick={() => togglePopup(rewards)}
          />
        ),
      });
    }
    return buttons;
  }, [structureEntityId, hasSeasonEnded, isPopupOpen, togglePopup]);

  return (
    <div className="flex h-full ml-auto">
      <div className="top-right-navigation-selector self-center flex space-x-2 mr-1">
        {/* Leaderboard/Rewards */}
        {leaderboardButtons.map((a, index) => (
          <div key={index}>{a.button}</div>
        ))}
        {/* Shortcuts */}
        <CircleButton
          className="shortcuts-selector border-none"
          tooltipLocation="bottom"
          active={isPopupOpen(shortcuts)}
          image={BuildingThumbs.question}
          label={"Shortcuts"}
          size="md"
          onClick={() => togglePopup(shortcuts)}
        />
        {/* Latest Features */}
        <CircleButton
          className="latest-features-selector border-none"
          tooltipLocation="bottom"
          active={isPopupOpen(latestFeatures)}
          image={BuildingThumbs.latestUpdates}
          label={"Latest Features"}
          size="md"
          onClick={() => togglePopup(latestFeatures)}
        />
        {/* Settings */}
        <CircleButton
          className="settings-selector border-none"
          tooltipLocation="bottom"
          active={isPopupOpen(settings)}
          image={BuildingThumbs.settings}
          label={"Settings"}
          size="md"
          onClick={() => togglePopup(settings)}
        />
        {/* Transactions */}
        <div className="relative">
          <CircleButton
            className="transactions-selector border-none"
            tooltipLocation="bottom"
            active={isPopupOpen(transactions)}
            image="/image-icons/network.png"
            label={"Transactions"}
            size="md"
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
          {/* Status dot indicator */}
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-dark-brown
                        ${txStatus.status === "idle" ? "bg-brilliance" : ""}
                        ${txStatus.status === "pending" ? "bg-gold animate-pulse" : ""}
                        ${txStatus.status === "stuck" ? "bg-orange animate-pulse" : ""}
                        ${txStatus.status === "error" ? "bg-danger" : ""}
                        shadow-[0_0_6px_currentColor]`}
          />
        </div>
        {/* Main menu (home) */}
        <HomeButton />
        {/* Controller button */}
        <Controller />
      </div>
    </div>
  );
};
