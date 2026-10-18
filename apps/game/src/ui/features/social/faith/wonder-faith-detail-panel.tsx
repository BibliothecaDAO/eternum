import { formatExact, formatPercent, formatRate } from "@bibliothecadao/types";
import { useGame } from "@/hooks/context/game-context";
import { HudButton, HudWindow } from "@/ui/design-system/kit/hud-elements";
import { toast } from "@/ui/features/event-feed/notify";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { buildWonderFaithDetail, type WonderFaithDetail } from "@/services/leaderboard/faith-leaderboard-service";
import { useFaithReadModels } from "@/services/leaderboard/use-faith-read-models";
import { displayAddress } from "@/ui/utils/utils";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useMemo, useState } from "react";

const isZeroAddress = (address: string): boolean => /^0x0+$/i.test(address.trim());

const getOwnerLabel = (detail: Pick<WonderFaithDetail, "ownerAddress" | "ownerName">): string => {
  if (detail.ownerName?.trim()) {
    return detail.ownerName.trim();
  }

  if (isZeroAddress(detail.ownerAddress)) {
    return "Unclaimed";
  }

  return displayAddress(detail.ownerAddress);
};

interface WonderFaithDetailPanelProps {
  wonderId: bigint | number | string;
  fallbackWonderName?: string;
  compact?: boolean;
  className?: string;
}

export const WonderFaithDetailPanel = ({
  wonderId,
  fallbackWonderName,
  compact = false,
  className,
}: WonderFaithDetailPanelProps) => {
  const {
    setup: { systemCalls },
    account: { account },
  } = useGame();
  const ordersAllowed = useUIStore(canIssueOrders);
  const [claiming, setClaiming] = useState(false);
  const claim = async (kind: "wonder" | "player") => {
    setClaiming(true);
    try {
      const value = { player: account.address, wonder_id: wonderId };
      if (kind === "wonder") await systemCalls.claim_wonder_points({ signer: account, value: wonderId });
      else await systemCalls.claim_player_faith_points({ signer: account, value });
    } catch (error) {
      toast.failed(error, "Faith claim failed");
    } finally {
      setClaiming(false);
    }
  };
  const readModels = useFaithReadModels();
  const wonderDetail = useMemo(() => buildWonderFaithDetail(readModels, wonderId), [readModels, wonderId]);

  if (!wonderDetail) {
    return (
      <div className={cn("rounded-lg border border-hud-line bg-hud-well p-3 text-hud-label text-hud-muted", className)}>
        No wonder faith details found.
      </div>
    );
  }

  const followers = wonderDetail.followers;
  const wonderName = wonderDetail.wonderName || fallbackWonderName || "Wonder";

  if (compact) {
    return (
      <div className={cn("grid grid-cols-2 gap-2 text-hud-label", className)}>
        <StatCard
          label="Total FP"
          value={formatExact(wonderDetail.totalFaithPoints)}
          mono
          compact
          className="col-span-2"
        />
        <StatCard label="FP/s" value={formatExact(wonderDetail.totalFaithPointsPerSec)} mono compact />
        <StatCard label="Followers" value={formatExact(wonderDetail.followerCount)} mono compact />
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3", className)}>
      <div className="rounded-lg border border-hud-line bg-hud-well p-3">
        <div className="flex flex-col gap-1">
          <span className="text-hud-label uppercase text-hud-muted">Wonder</span>
          <span className="text-hud-strong text-hud-accent">{wonderName}</span>
          <span className="text-hud-label text-hud-muted">Owner: {getOwnerLabel(wonderDetail)}</span>
        </div>
      </div>

      {ordersAllowed && (
        <div className="flex flex-wrap gap-2">
          <HudButton kind="secondary" disabled={claiming} onClick={() => claim("wonder")}>
            Update wonder points
          </HudButton>
          <HudButton kind="secondary" disabled={claiming} onClick={() => claim("player")}>
            Claim faith points
          </HudButton>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-hud-label">
        <StatCard label="Total FP" value={formatExact(wonderDetail.totalFaithPoints)} mono />
        <StatCard label="Total FP/sec" value={formatExact(wonderDetail.totalFaithPointsPerSec)} mono />
        <StatCard label="Own Baseline" value={formatExact(wonderDetail.ownBaselinePerSec)} mono />
        <StatCard label="Followers FP/sec" value={formatExact(wonderDetail.followersContributionPerSec)} mono />
      </div>

      <div className="rounded-lg border border-hud-line bg-hud-hover p-3">
        <div className="flex items-center justify-between text-hud-label uppercase text-hud-muted">
          <span>Per-Pledge Split</span>
          <span>
            {formatPercent(wonderDetail.ownerSharePercent / 100)} /{" "}
            {formatPercent(wonderDetail.followerSharePercent / 100)}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-hud-label text-hud-accent">
          <div className="rounded border border-hud-line bg-hud-well px-2 py-1">
            Wonder owner share
            <div className="font-mono text-hud-body text-hud-accent">
              {formatRate(wonderDetail.ownerSharePerSecFromFollowers)}
            </div>
          </div>
          <div className="rounded border border-hud-line bg-hud-well px-2 py-1">
            Followers share
            <div className="font-mono text-hud-body text-hud-accent">
              {formatRate(wonderDetail.followersSharePerSec)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-hud-line bg-hud-well">
        <div className="flex items-center justify-between border-b border-hud-divider px-3 py-2">
          <span className="text-hud-label uppercase text-hud-muted">Faithful Followers</span>
          <span className="text-hud-label text-hud-muted">{wonderDetail.followerCount}</span>
        </div>
        {followers.length === 0 ? (
          <div className="px-3 py-4 text-hud-label text-hud-muted">No faithful Realms or Villages yet.</div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="flex flex-col">
              {followers.map((follower) => (
                <div key={follower.structureId.toString()} className="flex gap-2 border-b border-hud-divider px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-hud-label text-hud-accent">{follower.structureLabel}</div>
                    <div className="truncate text-hud-label text-hud-muted">
                      {follower.structureTypeLabel} ·{" "}
                      {follower.ownerName?.trim() || displayAddress(follower.ownerAddress)}
                    </div>
                  </div>
                  <div className="w-24 text-right text-hud-label text-hud-muted">
                    30% owner
                    <div className="font-mono text-hud-label text-hud-accent">
                      {formatExact(follower.fpToWonderOwnerPerSec)}
                    </div>
                  </div>
                  <div className="w-24 text-right text-hud-label text-hud-muted">
                    70% follower
                    <div className="font-mono text-hud-label text-hud-accent">
                      {formatExact(follower.fpToFollowerOwnerPerSec)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  mono = false,
  compact = false,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  compact?: boolean;
  className?: string;
}) => (
  <div
    className={cn("min-w-0 rounded-md border border-hud-line bg-hud-well", compact ? "px-1 py-1.5" : "p-2", className)}
  >
    <div
      className={cn(
        compact ? "text-hud-label leading-tight text-hud-muted" : "text-hud-label uppercase text-hud-muted",
      )}
    >
      {label}
    </div>
    <div
      className={cn(
        "mt-1 text-hud-strong text-hud-accent",
        compact ? "text-hud-body leading-tight" : "text-hud-body",
        mono && "font-mono tabular-nums",
      )}
    >
      {value}
    </div>
  </div>
);

interface WonderFaithDetailModalProps {
  wonderId: bigint | number | string;
  fallbackWonderName?: string;
  onClose: () => void;
}

export const WonderFaithDetailModal = ({ wonderId, fallbackWonderName, onClose }: WonderFaithDetailModalProps) => {
  return (
    <HudWindow title="Wonder Faith Details" size="page" onClose={onClose}>
      <WonderFaithDetailPanel wonderId={wonderId} fallbackWonderName={fallbackWonderName} />
    </HudWindow>
  );
};
