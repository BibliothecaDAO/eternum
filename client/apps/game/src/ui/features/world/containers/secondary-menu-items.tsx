import { useTransactionStore } from "@/hooks/store/use-transaction-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useLatestFeaturesSeen } from "@/hooks/use-latest-features-seen";
import { useLandingLeaderboardStore } from "@/services/leaderboard/use-landing-leaderboard-store";
import { BuildingThumbs } from "@/ui/config";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { NetworkStatusPill } from "@/ui/features/world/components/network-status-pill";
import { triggerConnectionForceReconnect } from "@/ui/features/world/components/network-status-retry";
import { latestFeatures, leaderboard, rewards, settings, transactions } from "@/ui/features/world";
import { Controller } from "@/ui/modules/controller/controller";
import { TOP_PILL, TOP_PILL_TEXT } from "@/ui/features/world/containers/top-header/top-pill";
import { useDojo } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { Has } from "@dojoengine/recs";
import Trophy from "lucide-react/dist/esm/icons/trophy";

import { useCallback, useMemo } from "react";

const formatPoints = (points: number | null | undefined): string => {
  if (points === null || points === undefined) return "0";
  const rounded = Math.round(points);
  return Number.isFinite(rounded) ? rounded.toLocaleString() : "0";
};

const normalizeAddress = (value: string) => value.trim().toLowerCase();

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

export const SecondaryMenuItems = ({ variant }: SecondaryMenuItemsProps = {}) => {
  const {
    setup: {
      components: {
        events: { SeasonEnded },
      },
    },
    account: { account },
  } = useDojo();

  const hasSeasonEnded = useEntityQuery([Has(SeasonEnded)]).length > 0;

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

  // Pull cached leaderboard data populated by TopHeader's auto-fetch.
  const leaderboardEntries = useLandingLeaderboardStore((state) => state.entries);
  const playerEntries = useLandingLeaderboardStore((state) => state.playerEntries);
  const rankPill = useMemo(() => {
    if (!account?.address) return null;
    const normalized = normalizeAddress(account.address);
    const entry =
      playerEntries[normalized]?.data ??
      leaderboardEntries.find((e) => normalizeAddress(e.address) === normalized) ??
      null;
    if (!entry || entry.rank === undefined || entry.rank === null) return null;
    const rank = Number(entry.rank);
    const points = Number(entry.points ?? 0);
    // Match the gating in resolveTopHeaderPlayerStatus: only surface a rank suffix
    // when the player is meaningfully ranked.
    if (!Number.isFinite(rank)) return null;
    if (rank > 500 && points <= 0) return null;
    return { rank, points };
  }, [account?.address, leaderboardEntries, playerEntries]);

  const handleOpenLeaderboard = useCallback(() => togglePopup(leaderboard), [togglePopup]);

  const rankNode = rankPill ? (
    <button
      type="button"
      onClick={handleOpenLeaderboard}
      className={cn(
        TOP_PILL,
        TOP_PILL_TEXT,
        "transition hover:bg-gold/15",
        isPopupOpen(leaderboard) && "border-gold/60 bg-gold/15",
      )}
      aria-label="Open leaderboard"
      title="Open leaderboard"
    >
      <Trophy className="h-3.5 w-3.5 text-gold/80" aria-hidden="true" />
      <span>#{rankPill.rank}</span>
      <span className="text-gold/50">·</span>
      <span>{formatPoints(rankPill.points)} VP</span>
    </button>
  ) : (
    <CircleButton
      variant="hud"
      className="social-selector"
      tooltipLocation="bottom"
      image={BuildingThumbs.guild}
      label={leaderboard}
      active={isPopupOpen(leaderboard)}
      size="topbar"
      onClick={handleOpenLeaderboard}
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

      {/* Connection health indicator - only visible when unhealthy */}
      <div className="self-center">
        <NetworkStatusPill onRetry={triggerConnectionForceReconnect} />
      </div>

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

      {/* Settings — now hosts the Controller (wallet) panel too. Always last. */}
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

      {/* Controller (Cartridge wallet) — only surfaced here while the player is
          logged out, so the Login button stays discoverable. Once connected,
          the Controller lives inside the Settings popover. */}
      {!account && <Controller />}
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
