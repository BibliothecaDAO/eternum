import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useCoarseNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { openOnMap } from "@/play/navigation/open-place";
import { useFactView } from "@/hooks/use-fact-view";
import { gameStructuresView } from "@/sync/fact-views";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useLeaderboardActivity } from "@/hooks/use-leaderboard-activity";
import { playerAvatarUrl, usePlayerDisplayName } from "@/hooks/use-player-profile";
import {
  configManager,
  getEntityName,
  getGameMode,
  LeaderboardManager,
  Position,
  presentedMineKind,
  structureMapPosition,
} from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import type { PlayerActivityBreakdown } from "@bibliothecadao/eternum/game-sync";
import {
  ContractAddress,
  formatExact,
  formatPercent,
  formatRate,
  formatPoints,
  structureName,
  type StructureType,
} from "@bibliothecadao/types";
import { useMemo } from "react";

import { normalizeLeaderboardAddress } from "../player/finalized-blitz-leaderboard";
import { useInGameLeaderboard } from "../player/use-in-game-leaderboard";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";

/**
 * A player's detail beside the leaderboard: what earns them points and what they hold. Their points by activity, the
 * structures they own by kind, and the hyperstructures paying them now, each with its share, its points a second and a
 * way to go to it.
 */
export const PlayerId = ({
  selectedPlayer,
  selectedGuild,
  back,
}: {
  selectedPlayer: ContractAddress;
  selectedGuild?: ContractAddress;
  back?: () => void;
}) => {
  const name = usePlayerDisplayName(selectedPlayer);
  const address = normalizeLeaderboardAddress(selectedPlayer);
  const standing = useInGameLeaderboard().standingsByAddress.get(address);
  const { data: activity } = useLeaderboardActivity();
  const breakdown =
    activity?.find((entry) => normalizeLeaderboardAddress(entry.address) === address)?.activityBreakdown ?? null;
  const holdings = useHyperstructuresPaying(selectedPlayer);
  const owned = ownedStructures(useFactView(gameStructuresView), BigInt(selectedPlayer));
  const ownedTotal = owned.reduce((total, { count }) => total + count, 0);

  return (
    <section aria-label="Player details" className="flex flex-col gap-2 p-2">
      {selectedGuild !== undefined && back && (
        <button type="button" onClick={back} className={`flex items-center gap-1 self-start px-1 text-hud-body`}>
          <SemanticIcon name="arrow-left" className="h-3 w-3" /> Back
        </button>
      )}
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

      <HudPanel kind="section" collapsible={false} title="Hyperstructures giving points">
        {holdings.length === 0 ? (
          <p className="text-hud-body text-hud-cue">None now.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {holdings.map((holding) => (
              <HyperstructureRow key={holding.id} holding={holding} />
            ))}
          </ul>
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
    { label: "Crates opened", stat: breakdown.openRelicChest },
    { label: "Rifts and camps taken", stat: breakdown.otherStructureBanditsDefeat },
    { label: "Hyperstructures taken", stat: breakdown.hyperStructureBanditsDefeat },
    { label: "Hyperstructures held", stat: { ...breakdown.hyperstructureShare, count: 0 } },
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
    const name = structureName(structure.base.category as StructureType, presentedMineKind(structure), getGameMode());
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .toSorted((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

interface HyperstructurePaying {
  id: number;
  name: string;
  share: number;
  perSecond: number;
  position: Position | null;
}

/** One hyperstructure paying the player: its name, their share, what it pays them a second, and where it stands. */
const HyperstructureRow = ({ holding }: { holding: HyperstructurePaying }) => {
  const at = holding.position?.getNormalized();
  return (
    <li className="flex items-center gap-2">
      <span className={`min-w-0 flex-1 truncate text-hud-body`}>{holding.name}</span>
      <span className="text-hud-body tabular-nums text-hud-muted">{formatPercent(holding.share)}</span>
      <span className="text-hud-strong">points {formatRate(holding.perSecond)}</span>
      {at && (
        <button
          type="button"
          title="Go to it on the map"
          onClick={() => {
            // The map, on the hyperstructure, with it selected; the leaderboard closes so it shows.
            usePopoverStore.getState().close("leaderboard");
            openOnMap(holding.position!, { kind: "structure", entityId: holding.id });
          }}
          className="rounded-md border border-hud-line px-1.5 text-hud-body tabular-nums text-hud-accent hover:bg-hud-hover"
        >
          ({at.x}, {at.y})
        </button>
      )}
    </li>
  );
};

/** The hyperstructures paying the player now: their current shares at each allocation's rate, not what has accrued. */
const useHyperstructuresPaying = (player: ContractAddress): HyperstructurePaying[] => {
  const facts = useNativeFacts(["HyperstructureShares", "SliceRules", "GameRegistry", "Structure"]);
  const now = useCoarseNowSeconds(30);
  return useMemo(() => {
    const store = facts.store;
    void now;
    return LeaderboardManager.instance(store)
      .getPlayerHyperstructuresPaying(player)
      .map((share) => {
        const structure = store.get("Structure", {
          game_id: configManager.getActiveGameId(),
          entity_id: share.hyperstructureId,
        });
        const at = structure ? structureMapPosition(store, structure) : null;
        return {
          id: share.hyperstructureId,
          name: getEntityName(share.hyperstructureId, store) ?? "Hyperstructure",
          share: share.shareholderPercentage,
          perSecond: share.pointsPerSecond,
          position: at ? Position.fromContract({ x: at.x, y: at.y }) : null,
        };
      });
  }, [player, facts, now]);
};

const Avatar = ({ address }: { address: ContractAddress }) => {
  const url = playerAvatarUrl(address);
  return url ? <img src={url} alt="" className="h-8 w-8 rounded-full border border-hud-line object-cover" /> : null;
};
