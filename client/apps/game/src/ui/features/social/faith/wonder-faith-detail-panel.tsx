import { fetchWonderFaithDetail, type WonderFaithDetail } from "@/services/leaderboard/faith-leaderboard-service";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";
import { displayAddress } from "@/ui/utils/utils";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Loader from "lucide-react/dist/esm/icons/loader";

const AUTO_REFRESH_INTERVAL_MS = 30_000;

const formatInt = (value: number): string => value.toLocaleString("en-US");

const formatBigInt = (value: bigint): string => {
  const sign = value < 0n ? "-" : "";
  const digits = (value < 0n ? -value : value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}`;
};

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
    data: wonderDetail,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["wonder-faith-detail", String(wonderId)],
    queryFn: () => fetchWonderFaithDetail(wonderId),
    staleTime: 5_000,
    refetchInterval: AUTO_REFRESH_INTERVAL_MS,
  });

  if (isLoading) {
    return (
      <div className={cn("flex h-full min-h-[140px] items-center justify-center text-xs text-gold/70", className)}>
        <Loader className="mr-2 h-4 w-4 animate-spin" />
        Loading wonder faith...
      </div>
    );
  }

  if (error) {
    const message = error instanceof Error ? error.message : "Failed to load wonder faith details.";
    return (
      <div className={cn("rounded-lg border border-red-400/25 bg-red-950/20 p-3 text-xs text-red-200/90", className)}>
        {message}
      </div>
    );
  }

  if (!wonderDetail) {
    return (
      <div className={cn("rounded-lg border border-gold/20 bg-black/25 p-3 text-xs text-gold/70", className)}>
        No wonder faith details found.
      </div>
    );
  }

  const followers = wonderDetail.followers;
  const wonderName = wonderDetail.wonderName || fallbackWonderName || `Wonder #${wonderDetail.wonderId.toString()}`;

  if (compact) {
    return (
      <div className={cn("grid grid-cols-3 gap-2 text-xs", className)}>
        <StatCard label="Total FP" value={formatBigInt(wonderDetail.totalFaithPoints)} mono compact />
        <StatCard label="FP/sec" value={formatInt(wonderDetail.totalFaithPointsPerSec)} mono compact />
        <StatCard label="Followers" value={formatInt(wonderDetail.followerCount)} mono compact />
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3", className)}>
      <div className="rounded-lg border border-gold/25 bg-black/30 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-xxs uppercase tracking-[0.25em] text-gold/60">Wonder</span>
          <span className="text-sm font-semibold text-gold">{wonderName}</span>
          <span className="text-xxs text-gold/70">Owner: {getOwnerLabel(wonderDetail)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <StatCard label="Total FP" value={formatBigInt(wonderDetail.totalFaithPoints)} mono />
        <StatCard label="Total FP/sec" value={formatInt(wonderDetail.totalFaithPointsPerSec)} mono />
        <StatCard label="Own Baseline" value={formatInt(wonderDetail.ownBaselinePerSec)} mono />
        <StatCard label="Followers FP/sec" value={formatInt(wonderDetail.followersContributionPerSec)} mono />
      </div>

      <div className="rounded-lg border border-gold/20 bg-gold/5 p-3">
        <div className="flex items-center justify-between text-xxs uppercase tracking-[0.22em] text-gold/70">
          <span>Per-Pledge Split</span>
          <span>
            {wonderDetail.ownerSharePercent}% / {wonderDetail.followerSharePercent}%
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gold/85">
          <div className="rounded border border-gold/20 bg-black/20 px-2 py-1">
            Wonder owner share
            <div className="font-mono text-sm text-gold">
              {formatInt(wonderDetail.ownerSharePerSecFromFollowers)}/sec
            </div>
          </div>
          <div className="rounded border border-gold/20 bg-black/20 px-2 py-1">
            Followers share
            <div className="font-mono text-sm text-gold">{formatInt(wonderDetail.followersSharePerSec)}/sec</div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-gold/20 bg-black/20">
        <div className="flex items-center justify-between border-b border-gold/15 px-3 py-2">
          <span className="text-xxs uppercase tracking-[0.24em] text-gold/70">Faithful Followers</span>
          <span className="text-xxs text-gold/70">{wonderDetail.followerCount}</span>
        </div>
        {followers.length === 0 ? (
          <div className="px-3 py-4 text-xs text-gold/65">No faithful Realms, Villages, or Holy Sites yet.</div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="flex flex-col">
              {followers.map((follower) => (
                <div
                  key={follower.structureId.toString()}
                  className="grid grid-cols-[minmax(0,1fr)_96px_96px] gap-2 border-b border-gold/10 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-gold">{follower.structureLabel}</div>
                    <div className="truncate text-xxs text-gold/65">
                      {follower.structureTypeLabel} ·{" "}
                      {follower.ownerName?.trim() || displayAddress(follower.ownerAddress)}
                    </div>
                  </div>
                  <div className="text-right text-xxs text-gold/70">
                    30% owner
                    <div className="font-mono text-xs text-gold">{formatInt(follower.fpToWonderOwnerPerSec)}</div>
                  </div>
                  <div className="text-right text-xxs text-gold/70">
                    70% follower
                    <div className="font-mono text-xs text-gold">{formatInt(follower.fpToFollowerOwnerPerSec)}</div>
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
}: {
  label: string;
  value: string;
  mono?: boolean;
  compact?: boolean;
}) => (
  <div className={cn("rounded-md border border-gold/20 bg-black/25", compact ? "p-1.5" : "p-2")}>
    <div className="text-xxs uppercase tracking-[0.22em] text-gold/60">{label}</div>
    <div className={cn("mt-1 font-semibold text-gold", compact ? "text-xs" : "text-sm", mono && "font-mono")}>
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
    <SecondaryPopup width="980" name="wonder-faith-detail-modal" containerClassName="absolute left-0 top-0">
      <SecondaryPopup.Head onClose={onClose}>Wonder Faith Details</SecondaryPopup.Head>
      <SecondaryPopup.Body width="100%" height="auto">
        <div className="p-4">
          <WonderFaithDetailPanel wonderId={wonderId} fallbackWonderName={fallbackWonderName} />
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
