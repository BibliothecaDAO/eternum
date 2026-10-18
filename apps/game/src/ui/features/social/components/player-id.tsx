import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useGame } from "@/hooks/context/game-context";
import { useCoarseNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useLeaderboardActivity } from "@/hooks/use-leaderboard-activity";
import { playerAvatarUrl, usePlayerDisplayName } from "@/hooks/use-player-profile";
import { currencyIntlFormat } from "@/ui/utils/utils";
import {
  configManager,
  getEntityName,
  getIsBlitz,
  LeaderboardManager,
  Position,
  structureMapPosition,
} from "@bibliothecadao/eternum";
import type { PlayerActivityBreakdown } from "@bibliothecadao/eternum/game-sync";
import { ContractAddress } from "@bibliothecadao/types";
import { useMemo } from "react";

import { normalizeLeaderboardAddress } from "../player/finalized-blitz-leaderboard";
import { useInGameLeaderboard } from "../player/use-in-game-leaderboard";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";

/**
 * A player's detail beside the leaderboard: only what earns them points. Their points by activity, and the
 * hyperstructures paying them now, each with its share, its points a second and a way to go to it.
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
            #{standing.rank} · {currencyIntlFormat(standing.points)} points
          </span>
        )}
      </header>

      <HudPanel kind="section" collapsible={false} title="Points">
        <PointsByActivity breakdown={breakdown} />
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
            {stat.count > 0 && <span className="text-hud-muted"> · {stat.count.toLocaleString()}</span>}
          </dt>
          <dd className="text-hud-strong">{currencyIntlFormat(stat.points)} points</dd>
        </div>
      ))}
    </dl>
  );
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
  const navigateToMapView = useNavigateToMapView();
  const selectOnMap = useUIStore((state) => state.selectOnMap);
  const at = holding.position?.getNormalized();
  return (
    <li className="flex items-center gap-2">
      <span className={`min-w-0 flex-1 truncate text-hud-body`}>{holding.name}</span>
      <span className="text-hud-body tabular-nums text-hud-muted">{Math.round(holding.share * 100)}%</span>
      <span className="text-hud-strong">{currencyIntlFormat(holding.perSecond)} points/s</span>
      {at && (
        <button
          type="button"
          title="Go to it on the map"
          onClick={() => {
            // The map, on the hyperstructure, with it selected; the leaderboard closes so it shows.
            usePopoverStore.getState().close("leaderboard");
            navigateToMapView(holding.position!);
            selectOnMap({ kind: "structure", entityId: holding.id });
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
  const {
    setup: { store },
  } = useGame();
  const revision = useNativeRevision(["HyperstructureShares", "SliceRules", "GameRegistry", "Structure"]);
  const now = useCoarseNowSeconds(30);
  return useMemo(() => {
    void revision;
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
          name: getEntityName(share.hyperstructureId, store, getIsBlitz()) ?? "Hyperstructure",
          share: share.shareholderPercentage,
          perSecond: share.pointsPerSecond,
          position: at ? Position.fromContract({ x: at.x, y: at.y }) : null,
        };
      });
  }, [player, store, revision, now]);
};

const Avatar = ({ address }: { address: ContractAddress }) => {
  const url = playerAvatarUrl(address);
  return url ? <img src={url} alt="" className="h-8 w-8 rounded-full border border-hud-line object-cover" /> : null;
};
