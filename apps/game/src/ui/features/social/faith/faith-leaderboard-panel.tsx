import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { displayAddress } from "@/ui/utils/utils";
import { buildFaithLeaderboard, type FaithLeaderboardEntry } from "@/services/leaderboard/faith-leaderboard-service";
import { useFaithReadModels } from "@/services/leaderboard/use-faith-read-models";
import { WonderFaithDetailModal } from "./wonder-faith-detail-panel";
import { useCallback, useMemo } from "react";

const formatIntegerWithCommas = (value: number): string => value.toLocaleString("en-US");

const formatBigIntWithCommas = (value: bigint): string => {
  const sign = value < 0n ? "-" : "";
  const digits = (value < 0n ? -value : value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}`;
};

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
  const readModels = useFaithReadModels();
  const entries = useMemo(() => buildFaithLeaderboard(readModels), [readModels]);

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
    [openSurface],
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
          <table className="w-full min-w-[760px] text-left text-hud-label">
            <thead className="sticky top-0 z-10 bg-[#1d160e] text-hud-accent">
              <tr>
                <th className="px-3 py-2 text-center text-hud-strong">#</th>
                <th className="px-3 py-2 text-hud-strong">Wonder</th>
                <th className="px-3 py-2 text-hud-strong">Owner</th>
                <th className="px-3 py-2 text-right text-hud-strong">Total FP</th>
                <th className="px-3 py-2 text-right text-hud-strong">FP/sec</th>
                <th className="px-3 py-2 text-right text-hud-strong">Followers</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.wonderId.toString()}
                  className="cursor-pointer border-t border-hud-divider text-hud-accent transition hover:bg-hud-hover"
                  role="button"
                  tabIndex={0}
                  onClick={() => openWonderDetails(entry)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openWonderDetails(entry);
                    }
                  }}
                >
                  <td className="px-3 py-2 text-center">{entry.rank}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="text-hud-strong text-hud-accent">{entry.wonderName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="text-hud-accent">{buildOwnerLabel(entry)}</span>
                      <span className="text-hud-label text-hud-muted">
                        {isZeroAddress(entry.ownerAddress) ? "No owner recorded" : displayAddress(entry.ownerAddress)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatBigIntWithCommas(entry.totalFaithPoints)}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatIntegerWithCommas(entry.faithPointsPerSecond)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatIntegerWithCommas(entry.followerCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
