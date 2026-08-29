import { useTransactionStore } from "@/hooks/store/use-transaction-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useLatestFeaturesSeen } from "@/hooks/use-latest-features-seen";
import { BuildingThumbs } from "@/ui/config";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { normalizeLeaderboardAddress } from "@/ui/features/social/player/finalized-blitz-leaderboard";
import { useInGameLeaderboard } from "@/ui/features/social/player/use-in-game-leaderboard";
import { NetworkStatusPill } from "@/ui/features/world/components/network-status-pill";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";
import { latestFeatures, leaderboard, rewards, settings, transactions } from "@/ui/features/world";
import { TOP_PILL, TOP_PILL_TEXT } from "@/ui/features/world/containers/top-header/top-pill";

import { useDojo, usePlayers } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { Has } from "@dojoengine/recs";

import { useCallback, useMemo } from "react";
import { gameEntityKey } from "@/sync/game-scope";

const formatPoints = (points: number | null | undefined): string => {
  if (points === null || points === undefined) return "0";
  const rounded = Math.round(points);
  return Number.isFinite(rounded) ? rounded.toLocaleString() : "0";
};

interface SecondaryMenuItemsProps {
  /**
   * "rank" → only the leaderboard rank pill (used at the left of the top bar).
   * "rest" → settings + ancillary status icons (network, transactions, latest
   *          features, rewards, controller) clustered to the right of settings.
   * undefined → the legacy "everything in one group" rendering (kept so older
   *           callers don't break, but new callers should pick a variant).
   */
  variant?: "rank" | "rest";
}

const LeaderboardRankNode = ({
  accountAddress,
  isOpen,
  onOpen,
}: {
  accountAddress: string | undefined;
  isOpen: boolean;
  onOpen: () => void;
}) => {
  const players = usePlayers();
  const { standingsByAddress } = useInGameLeaderboard();
  const rankPill = useMemo(() => {
    if (!accountAddress) return null;
    const playerAddress = ContractAddress(accountAddress);
    const standing = standingsByAddress.get(normalizeLeaderboardAddress(playerAddress));
    if (!standing) return null;

    const { rank, points } = standing;
    if (!Number.isFinite(rank)) return null;
    if (rank > 500 && points <= 0) return null;
    return {
      rank,
      points,
      name: players.find((player) => player.address === playerAddress)?.name ?? null,
    };
  }, [accountAddress, players, standingsByAddress]);

  if (!rankPill) {
    return (
      <CircleButton
        variant="hud"
        className="social-selector"
        tooltipLocation="bottom"
        image={BuildingThumbs.guild}
        label={leaderboard}
        active={isOpen}
        size="topbar"
        onClick={onOpen}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        TOP_PILL,
        TOP_PILL_TEXT,
        "whitespace-nowrap transition hover:bg-gold/15",
        isOpen && "border-gold/60 bg-gold/15",
      )}
      aria-label="Open leaderboard"
      title="Open leaderboard"
    >
      <img src={BuildingThumbs.guild} alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
      {rankPill.name && (
        <>
          <span className="max-w-[120px] truncate">{rankPill.name}</span>
          <span className="text-gold/50">·</span>
        </>
      )}
      <span>#{rankPill.rank}</span>
      <span className="text-gold/50">·</span>
      <span>{formatPoints(rankPill.points)} VP</span>
    </button>
  );
};

export const SecondaryMenuItems = ({ variant }: SecondaryMenuItemsProps = {}) => {
  const {
    setup: {
      components: {
        GameRegistry,
        events: { SeasonEnded },
      },
    },
    account: { account },
  } = useDojo();

  // Legacy worlds emit a SeasonEnded event; the s2 single world flips the
  // active game's registry status instead.
  const hasSeasonEndedEvent = useEntityQuery([Has(SeasonEnded)]).length > 0;
  const gameRegistry = useComponentValue(
    GameRegistry,
    useMemo(() => gameEntityKey([]), []),
  );
  const registryStatus = gameRegistry ? String(gameRegistry.status) : "";
  const hasSeasonEnded = hasSeasonEndedEvent || registryStatus === "Ended" || registryStatus === "Settled";

  const { unseenCount: unseenFeaturesCount } = useLatestFeaturesSeen();

  const togglePopup = useUIStore((state) => state.togglePopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);

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

  const handleOpenLeaderboard = useCallback(() => togglePopup(leaderboard), [togglePopup]);
  const rankNode = (
    <LeaderboardRankNode
      accountAddress={account?.address}
      isOpen={isPopupOpen(leaderboard)}
      onOpen={handleOpenLeaderboard}
    />
  );

  const restNodes = (
    <>
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

      {/* Settings stays last in the utility cluster. */}
      <CircleButton
        variant="hud"
        className="settings-selector"
        tooltipLocation="bottom"
        active={isPopupOpen(settings)}
        image={BuildingThumbs.settings}
        label={"Settings"}
        size="topbar"
        onClick={() => togglePopup(settings)}
      />
    </>
  );

  if (variant === "rank") {
    return <div className="pointer-events-auto flex items-center">{rankNode}</div>;
  }

  if (variant === "rest") {
    return <div className="pointer-events-auto flex items-center gap-2">{restNodes}</div>;
  }

  return (
    <div className="flex h-full ml-auto">
      <div className="top-right-navigation-selector self-center flex items-center space-x-2 mr-1">
        {rankNode}
        {restNodes}
      </div>
    </div>
  );
};
