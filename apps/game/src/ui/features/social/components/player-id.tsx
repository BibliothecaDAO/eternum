import { useFactView } from "@/hooks/use-fact-view";
import { gameStructuresView } from "@/sync/fact-views";
import { useLeaderboardActivity } from "@/hooks/use-leaderboard-activity";
import { usePlayerDisplayName, usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { presentedMineKind } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import type { PlayerActivityBreakdown } from "@bibliothecadao/eternum/game-sync";
import { ContractAddress, formatExact, formatPoints, structureName, type StructureType } from "@bibliothecadao/types";

import { normalizeLeaderboardAddress } from "../player/finalized-blitz-leaderboard";
import { useInGameLeaderboard } from "../player/use-in-game-leaderboard";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";

export const PlayerId = ({ selectedPlayer }: { selectedPlayer: ContractAddress }) => {
  const name = usePlayerDisplayName(selectedPlayer);
  const address = normalizeLeaderboardAddress(selectedPlayer);
  const standing = useInGameLeaderboard().standingsByAddress.get(address);
  const { data: activity } = useLeaderboardActivity();
  const breakdown =
    activity?.find((entry) => normalizeLeaderboardAddress(entry.address) === address)?.activityBreakdown ?? null;
  const owned = ownedStructures(useFactView(gameStructuresView), BigInt(selectedPlayer));
  const ownedTotal = owned.reduce((total, { count }) => total + count, 0);

  return (
    <section aria-label="Player details" className="flex flex-col gap-2 p-2">
      <header className="flex items-center gap-2 px-1">
        <Avatar address={selectedPlayer} />
        <span className={`min-w-0 flex-1 truncate text-hud-title`}>{name || "Unknown player"}</span>
        {standing && (
          <span className="text-hud-strong">
            #{standing.rank} · {formatPoints(standing.points)}
          </span>
        )}
      </header>

      <HudPanel kind="section" collapsible={false} title="Points">
        <PointsByActivity breakdown={breakdown} />
      </HudPanel>

      <HudPanel
        kind="section"
        collapsible={false}
        title="Structures"
        cue={ownedTotal > 0 ? formatExact(ownedTotal) : undefined}
      >
        {owned.length === 0 ? (
          <p className="text-hud-body text-hud-cue">None.</p>
        ) : (
          <dl aria-label="Structures owned" className="flex flex-col gap-1">
            {owned.map(({ name, count }) => (
              <div key={name} className="flex items-baseline justify-between gap-2">
                <dt className="text-hud-body">{name}</dt>
                <dd className="text-hud-strong">{formatExact(count)}</dd>
              </div>
            ))}
          </dl>
        )}
      </HudPanel>
    </section>
  );
};

/** The activities that earned the player points, each with its count and points; nothing for one that earned none. */
export const PointsByActivity = ({ breakdown }: { breakdown: PlayerActivityBreakdown | null }) => {
  if (!breakdown) return <p className="text-hud-body text-hud-cue">Reading the points…</p>;
  const lines = [
    { label: "Tiles explored", stat: breakdown.exploration },
    { label: "Rifts and camps taken", stat: breakdown.otherStructureBanditsDefeat },
  ].filter(({ stat }) => stat.points > 0);
  if (lines.length === 0) return <p className="text-hud-body text-hud-cue">No points yet.</p>;
  return (
    <dl className="flex flex-col gap-1">
      {lines.map(({ label, stat }) => (
        <div key={label} className="flex items-baseline justify-between gap-2">
          <dt className="text-hud-body">
            {label}
            {stat.count > 0 && <span className="text-hud-muted"> · {formatExact(stat.count)}</span>}
          </dt>
          <dd className="text-hud-strong">{formatPoints(stat.points)}</dd>
        </div>
      ))}
    </dl>
  );
};

/** What a player owns, by kind (a mine by what it yields), the most held first: "Realm 2", "Camp 1". */
const ownedStructures = (
  structures: readonly NativeRows["Structure"][],
  owner: bigint,
): { name: string; count: number }[] => {
  const counts = new Map<string, number>();
  for (const structure of structures) {
    if (structure.owner !== owner) continue;
    const name = structureName(structure.base.category as StructureType, presentedMineKind(structure));
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .toSorted((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

/** The player's portrait as identity has it; nothing until their profile is known. */
const Avatar = ({ address }: { address: ContractAddress }) => {
  const profile = usePlayerProfile(address);
  return profile.known ? (
    <img
      src={playerPortraitUrl(address, profile.portrait)}
      alt=""
      className="h-8 w-8 rounded-full border border-hud-line object-cover"
    />
  ) : null;
};
