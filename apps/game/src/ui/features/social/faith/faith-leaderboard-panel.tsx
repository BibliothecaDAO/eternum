import { formatExact } from "@bibliothecadao/types";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { displayAddress } from "@/ui/utils/utils";
import type { FaithLeaderboardEntry } from "@/services/leaderboard/faith-leaderboard-service";
import { useFaithLeaderboard } from "@/services/leaderboard/use-faith-leaderboard";
import { WonderFaithDetailModal } from "./wonder-faith-detail-panel";
import { useCallback } from "react";
import { HudTableHead, HudTableRow } from "@/ui/design-system/kit/hud-elements";

/** Rank, wonder, owner, total faith, faith a second and followers. */
const FAITH_COLS = "48px minmax(180px, 1.4fr) minmax(180px, 1.4fr) 120px 100px 100px";

const isZeroAddress = (address: string): boolean => {
  return /^0x0+$/i.test(address.trim());
};

const buildOwnerLabel = (entry: FaithLeaderboardEntry): string => {
  if (entry.ownerName?.trim()) {
    return entry.ownerName.trim();
  }

  if (isZeroAddress(entry.ownerAddress)) {
    return "Unclaimed";
  }

  return displayAddress(entry.ownerAddress);
};

export const FaithLeaderboardPanel = () => {
  const openSurface = usePopoverStore((state) => state.openSurface);
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const entries = useFaithLeaderboard();

  const hasEntries = entries.length > 0;
  const openWonderDetails = useCallback(
    (entry: FaithLeaderboardEntry) => {
      openSurface({
        id: "wonder-faith",
        content: (
          <WonderFaithDetailModal
            wonderId={entry.wonderId}
            fallbackWonderName={entry.wonderName}
            onClose={closeSurface}
          />
        ),
      });
    },
    [openSurface, closeSurface],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-hud-strong text-hud-accent">Faith Leaderboard</span>
          <span className="text-hud-label text-hud-muted">Live from the game stream</span>
          <span className="text-hud-label text-hud-cue">Total FP includes estimated unclaimed points from FP/sec.</span>
        </div>
      </div>

      {!hasEntries ? (
        <div className="flex h-full items-center justify-center text-hud-label text-hud-muted">
          No wonder faith data found for this world.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-hud-divider bg-hud-well">
          <div className="min-w-max">
            <HudTableHead cols={FAITH_COLS}>
              <span className="text-center">#</span>
              <span>Wonder</span>
              <span>Owner</span>
              <span className="text-right">Total FP</span>
              <span className="text-right">FP/sec</span>
              <span className="text-right">Followers</span>
            </HudTableHead>
            {entries.map((entry) => (
              <HudTableRow
                key={entry.wonderId.toString()}
                cols={FAITH_COLS}
                label={`${entry.wonderName}: its faith`}
                onClick={() => openWonderDetails(entry)}
              >
                <span className="text-center">{entry.rank}</span>
                <span className="text-hud-strong">{entry.wonderName}</span>
                <span className="flex flex-col">
                  <span>{buildOwnerLabel(entry)}</span>
                  <span className="text-hud-label text-hud-muted">
                    {isZeroAddress(entry.ownerAddress) ? "No owner recorded" : displayAddress(entry.ownerAddress)}
                  </span>
                </span>
                <span className="text-right font-mono">{formatExact(entry.totalFaithPoints)}</span>
                <span className="text-right font-mono">{formatExact(entry.faithPointsPerSecond)}</span>
                <span className="text-right font-mono">{formatExact(entry.followerCount)}</span>
              </HudTableRow>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
