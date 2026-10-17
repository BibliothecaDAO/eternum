import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { playerAvatarUrl } from "@/hooks/use-player-profile";
import { ENABLE_LEADERBOARD_EFFECTS_MOCKUP } from "@/ui/constants";
import { currencyIntlFormat } from "@/ui/utils/utils";
import type { PlayerActivityBreakdown } from "@/services/leaderboard/player-activity-breakdown-service";
import type { configManager } from "@bibliothecadao/eternum";
import { NEUTRAL_OWNER_NAME, ContractAddress, GuildInfo, PlayerInfo } from "@bibliothecadao/types";
import clsx from "clsx";
import gsap from "gsap";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LeaderboardEffectsOverlay } from "./leaderboard-effects";
import type { MmrForecast } from "./mmr-forecast";
import { PlayerEffect, useLeaderboardEffects } from "./use-leaderboard-effects";

const COUNT_FORMATTER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const ROW_HEIGHT = 44; // Approximate row height in pixels

export interface PlayerCustom extends PlayerInfo {
  isUser: boolean;
  isInvited: boolean;
  guild: GuildInfo | undefined;
  activityBreakdown: PlayerActivityBreakdown | null;
  includesLiveShareholderPoints: boolean;
  /** The MMR the player would gain or lose if the game ended now; null where the ledger gave none. */
  mmrDelta: number | null;
}

/** The points each activity grants, as the game's rules give them. */
export type VictoryPointGrants = ReturnType<typeof configManager.getVictoryPointGrants>;

interface PlayerListProps {
  players: PlayerCustom[];
  grants: VictoryPointGrants;
  /** Whether the MMR column shows (a rated game), and what it says while the ledger has no answer. */
  mmr: MmrForecast["status"];
  focusOwnPlayer?: boolean;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  whitelistPlayer: (address: ContractAddress) => void;
  isLoading: boolean;
}

interface PlayerWithActivityStats extends PlayerCustom {
  tilesExplored: number;
  tilesExploredPoints: number;
  cratesOpened: number;
  cratesOpenedPoints: number;
  riftsTaken: number;
  riftsTakenPoints: number;
  hyperstructuresTaken: number;
  hyperstructuresTakenPoints: number;
  hyperstructuresHeld: number;
  hyperstructuresHeldPoints: number;
}

const formatActivityValue = (count: number, points: number): string => {
  if (count > 0 && points > 0) {
    return `${COUNT_FORMATTER.format(count)} · ${currencyIntlFormat(points)} pts`;
  }

  if (count > 0) return COUNT_FORMATTER.format(count);
  if (points > 0) return `${currencyIntlFormat(points)} pts`;
  return "—";
};

/** The table's columns: fixed widths on wide screens, so the window is exactly the table's width; MMR adds one. */
const GRID_TEMPLATES = {
  plain: "grid-cols-[44px_minmax(0,_1fr)_auto] md:grid-cols-[48px_220px_repeat(5,_96px)_80px]",
  plainMmr: "grid-cols-[44px_minmax(0,_1fr)_auto_auto] md:grid-cols-[48px_220px_repeat(5,_96px)_80px_80px]",
  tribe: "grid-cols-[44px_minmax(0,_1fr)_auto] md:grid-cols-[48px_200px_120px_repeat(5,_96px)_80px]",
  tribeMmr: "grid-cols-[44px_minmax(0,_1fr)_auto_auto] md:grid-cols-[48px_200px_120px_repeat(5,_96px)_80px_80px]",
} as const;

/** A rating change as a player reads it: +26 in green, −11 in red, ±0, or a dash where the ledger gave none. */
const MmrDeltaCell = ({ delta }: { delta: number | null }) => (
  <div
    className={clsx("text-right text-sm font-semibold tabular-nums md:text-center", {
      "text-emerald-300": delta !== null && delta > 0,
      "text-red-300": delta !== null && delta < 0,
      "text-gold/60": delta === null || delta === 0,
    })}
  >
    {delta === null ? "—" : delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : "±0"}
  </div>
);

/** A column only wide screens have room for; a narrow row says it under the name instead. */
const WIDE_ONLY = "hidden md:flex";

/** What a player did, in words, for the narrow row that has no columns for it: "3 tiles, 1 crate". */
const summarizeActivity = (player: PlayerWithActivityStats): string =>
  [
    [player.tilesExplored, "tile", "tiles"],
    [player.cratesOpened, "crate", "crates"],
    [player.riftsTaken, "rift or camp", "rifts and camps"],
    [player.hyperstructuresTaken, "hyperstructure taken", "hyperstructures taken"],
    [player.hyperstructuresHeld, "hyperstructure held", "hyperstructures held"],
  ]
    .filter(([count]) => (count as number) > 0)
    .map(([count, one, many]) => `${COUNT_FORMATTER.format(count as number)} ${count === 1 ? one : many}`)
    .join(", ");

const resolvePlayerActivityStats = (player: PlayerCustom): PlayerWithActivityStats => {
  const activity = player.activityBreakdown;

  return {
    ...player,
    tilesExplored: activity?.exploration.count ?? 0,
    tilesExploredPoints: activity?.exploration.points ?? 0,
    cratesOpened: activity?.openRelicChest.count ?? 0,
    cratesOpenedPoints: activity?.openRelicChest.points ?? 0,
    riftsTaken: activity?.otherStructureBanditsDefeat.count ?? 0,
    riftsTakenPoints: activity?.otherStructureBanditsDefeat.points ?? 0,
    hyperstructuresTaken: activity?.hyperStructureBanditsDefeat.count ?? 0,
    hyperstructuresTakenPoints: activity?.hyperStructureBanditsDefeat.points ?? 0,
    hyperstructuresHeld: player.hyperstructures,
    hyperstructuresHeldPoints: activity?.hyperstructureShare.points ?? 0,
  };
};

export const PlayerList = ({
  players,
  grants,
  mmr,
  viewPlayerInfo,
  whitelistPlayer,
  isLoading,
  focusOwnPlayer = false,
}: PlayerListProps) => {
  const [selectedPlayerAddress, setSelectedPlayerAddress] = useState<string | null>(null);
  const mode = useGameModeConfig();
  const showTribeDetails = mode.ui.showGuildsTab;
  const [prevPositions, setPrevPositions] = useState<Map<string, number>>(new Map());
  const showMmr = mmr !== "off";
  const leaderboardGridTemplate = GRID_TEMPLATES[`${showTribeDetails ? "tribe" : "plain"}${showMmr ? "Mmr" : ""}`];

  useEffect(() => {
    if (!selectedPlayerAddress) {
      return;
    }

    const stillVisible = players.some((player) => String(player.address) === selectedPlayerAddress);

    if (!stillVisible) {
      setSelectedPlayerAddress(null);
    }
  }, [players, selectedPlayerAddress]);

  const playersWithActivityStats = useMemo(() => players.map(resolvePlayerActivityStats), [players]);

  const filteredPlayers = useMemo(
    () => playersWithActivityStats.filter((player) => !player.name.includes("Central Bank")),
    [playersWithActivityStats],
  );

  // The leaderboard is always ranked — no column sorting. Sort ascending by the
  // resolved leaderboard rank so #1 is on top.
  const sortedPlayers = useMemo(() => {
    return filteredPlayers.toSorted((a, b) => a.rank - b.rank);
  }, [filteredPlayers]);

  // Leaderboard effects for animations
  const { effects, rowRefs } = useLeaderboardEffects(filteredPlayers, ENABLE_LEADERBOARD_EFFECTS_MOCKUP);

  const focusedOwnRow = useRef(false);
  useEffect(() => {
    if (!focusOwnPlayer || focusedOwnRow.current) return;
    const ownPlayer = sortedPlayers.find((player) => player.isUser);
    if (!ownPlayer) return;
    const address = String(ownPlayer.address);
    const row = rowRefs.current.get(address.toLowerCase());
    if (!row) return;
    focusedOwnRow.current = true;
    setSelectedPlayerAddress(address);
    row.scrollIntoView({ block: "center" });
  }, [focusOwnPlayer, sortedPlayers, rowRefs]);

  // FLIP animation for row reordering
  useLayoutEffect(() => {
    if (prevPositions.size === 0) {
      // First render - just store positions
      const newPositions = new Map<string, number>();
      sortedPlayers.forEach((p, i) => newPositions.set(String(p.address), i));
      setPrevPositions(newPositions);
      return;
    }

    // Animate rows from old position to new
    sortedPlayers.forEach((player, index) => {
      const address = String(player.address);
      const prevIndex = prevPositions.get(address);

      if (prevIndex !== undefined && prevIndex !== index) {
        const rowEl = rowRefs.current.get(address.toLowerCase());
        if (rowEl) {
          const deltaY = (prevIndex - index) * ROW_HEIGHT;
          gsap.fromTo(rowEl, { y: deltaY }, { y: 0, duration: 0.4, ease: "power2.out" });
        }
      }
    });

    // Store current positions for next comparison
    const newPositions = new Map<string, number>();
    sortedPlayers.forEach((p, i) => newPositions.set(String(p.address), i));
    setPrevPositions(newPositions);
  }, [sortedPlayers, rowRefs]);

  const handleSelectPlayer = (address: PlayerCustom["address"]) => {
    const normalized = String(address);

    setSelectedPlayerAddress(normalized);
    viewPlayerInfo(ContractAddress(normalized));
  };

  // Register row ref callback
  const registerRowRef = useCallback(
    (address: string, el: HTMLDivElement | null) => {
      const normalizedAddress = address.toLowerCase();
      if (el) {
        rowRefs.current.set(normalizedAddress, el);
      } else {
        rowRefs.current.delete(normalizedAddress);
      }
    },
    [rowRefs],
  );

  return (
    <div className="flex flex-col">
      <ScoringRulesLine showTribeDetails={showTribeDetails} grants={grants} />
      <PlayerListHeader
        showTribeDetails={showTribeDetails}
        grants={grants}
        mmr={mmr}
        gridTemplateClass={leaderboardGridTemplate}
      />

      <div className="mt-2">
        {sortedPlayers.length > 0 ? (
          sortedPlayers.map((player) => {
            const normalizedAddress = String(player.address);
            const playerEffect = effects.get(normalizedAddress.toLowerCase());
            const avatarUrl = playerAvatarUrl(player.address);

            return (
              <PlayerRow
                key={normalizedAddress}
                player={player}
                avatarUrl={avatarUrl}
                onSelect={() => handleSelectPlayer(player.address)}
                whitelistPlayer={whitelistPlayer}
                isLoading={isLoading}
                showTribeDetails={showTribeDetails}
                showMmr={showMmr}
                gridTemplateClass={leaderboardGridTemplate}
                isSelected={selectedPlayerAddress === normalizedAddress}
                effect={playerEffect}
                registerRef={(el) => registerRowRef(normalizedAddress, el)}
              />
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-gold/60">
            <SemanticIcon name="person" className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No players found</p>
          </div>
        )}
      </div>

      {/* Effects overlay - rendered via portal */}
      <LeaderboardEffectsOverlay effects={effects} rowRefs={rowRefs} showTribeDetails={showTribeDetails} />
    </div>
  );
};

/** A column of the table: its name, and for an activity the points it grants, with the rule in full on hover. */
interface PlayerListColumn {
  label: string;
  align: string;
  grant?: string;
  rule?: string;
}

/** Each activity column carries its grant under its name: the game's scoring table, where the points it counts are. */
const resolveColumns = (
  showTribeDetails: boolean,
  grants: VictoryPointGrants,
  mmr: MmrForecast["status"],
): PlayerListColumn[] => {
  const each = (points: number) => `${currencyIntlFormat(points)} each`;
  const activity = `${WIDE_ONLY} flex-col justify-center text-center`;
  return [
    { label: "Rank", align: "justify-center text-center" },
    { label: "Name", align: "justify-start text-left" },
    ...(showTribeDetails ? [{ label: "Tribe", align: "hidden text-left md:block" }] : []),
    { label: "Tiles", align: activity, grant: each(grants.exploreTile), rule: "Explore a tile" },
    { label: "Crates", align: activity, grant: each(grants.openRelicCrate), rule: "Open a relic crate" },
    {
      label: "Rifts/Camps",
      align: activity,
      grant: each(grants.claimCampFromBandits),
      rule: `Claim an Essence Rift or Camp from ${NEUTRAL_OWNER_NAME}`,
    },
    {
      label: "HS Taken",
      align: activity,
      grant: each(grants.claimHyperstructureFromBandits),
      rule: `Claim a Hyperstructure from ${NEUTRAL_OWNER_NAME}`,
    },
    {
      label: "HS Held",
      align: activity,
      grant: `${currencyIntlFormat(grants.hyperstructurePerRealmPerSecond)}/s a realm`,
      rule: "Control a Hyperstructure: points every second for each realm settled within 8 tiles of it",
    },
    { label: "Points", align: "justify-end text-right md:justify-center md:text-center" },
    ...(mmr === "off"
      ? []
      : [
          {
            label: "MMR",
            align: "flex flex-col justify-center text-center",
            grant: mmr === "unavailable" ? "unavailable" : "if it ended now",
            rule: "The rating each player would gain or lose if the game ended with these standings, as the ledger settles it",
          },
        ]),
  ];
};

/**
 * The scoring rules where the activity columns are hidden (a phone): the same grants the wide header puts under each
 * column, in one line above the table.
 */
const ScoringRulesLine = ({ showTribeDetails, grants }: { showTribeDetails: boolean; grants: VictoryPointGrants }) => (
  <p aria-label="Scoring rules" className="px-3 pb-2 text-xs text-gold/60 md:hidden">
    {resolveColumns(showTribeDetails, grants, "off")
      .filter((column) => column.grant)
      .map((column) => `${column.label} ${column.grant}`)
      .join(" · ")}
  </p>
);

const PlayerListHeader = ({
  showTribeDetails,
  grants,
  mmr,
  gridTemplateClass,
}: {
  showTribeDetails: boolean;
  grants: VictoryPointGrants;
  mmr: MmrForecast["status"];
  gridTemplateClass: string;
}) => {
  const setTooltip = useTooltipStore((state) => state.setTooltip);
  const columns = useMemo(() => resolveColumns(showTribeDetails, grants, mmr), [showTribeDetails, grants, mmr]);

  return (
    // Opaque, on the window's own surface, so the sticky header never shows the rows scrolling under it.
    <div
      className={clsx(
        "grid gap-x-3 items-center py-2 px-3 border-b border-gold/25 sticky top-0 z-20 bg-[var(--overlay-surface-from)] md:gap-x-4 md:px-4",
        gridTemplateClass,
      )}
    >
      {columns.map(({ label, align, grant, rule }) => (
        <div
          key={label}
          className={clsx("w-full items-center text-sm font-semibold text-gold/80", align)}
          onMouseEnter={
            rule ? () => setTooltip({ content: <div className="text-gold">{rule}</div>, position: "top" }) : undefined
          }
          onMouseLeave={rule ? () => setTooltip(null) : undefined}
        >
          <span>{label}</span>
          {grant && <span className="text-xs font-normal text-gold/55">{grant}</span>}
        </div>
      ))}
    </div>
  );
};

const PlayerRow = ({
  player,
  avatarUrl,
  onSelect,
  whitelistPlayer,
  isLoading,
  showTribeDetails,
  showMmr,
  gridTemplateClass,
  isSelected,
  effect,
  registerRef,
}: {
  player: PlayerWithActivityStats;
  avatarUrl: string | null;
  onSelect: () => void;
  whitelistPlayer: (address: ContractAddress) => void;
  isLoading: boolean;
  showTribeDetails: boolean;
  showMmr: boolean;
  gridTemplateClass: string;
  isSelected: boolean;
  effect?: PlayerEffect;
  registerRef: (el: HTMLDivElement | null) => void;
}) => {
  const setTooltip = useTooltipStore((state) => state.setTooltip);

  const isUnranked = player.points === null || player.rank === Number.MAX_SAFE_INTEGER;
  const tilesLabel = formatActivityValue(player.tilesExplored, player.tilesExploredPoints);
  const cratesLabel = formatActivityValue(player.cratesOpened, player.cratesOpenedPoints);
  const riftsLabel = formatActivityValue(player.riftsTaken, player.riftsTakenPoints);
  const hyperstructuresTakenLabel = formatActivityValue(player.hyperstructuresTaken, player.hyperstructuresTakenPoints);
  const hyperstructuresHeldLabel = formatActivityValue(player.hyperstructuresHeld, player.hyperstructuresHeldPoints);
  const hasShareholderPoints = Boolean(player.includesLiveShareholderPoints);
  const activitySummary = summarizeActivity(player);

  // Determine row glow based on effect
  const hasRankUp = effect && effect.rankChange < 0;
  const hasRankDown = effect && effect.rankChange > 0;

  return (
    <div
      ref={registerRef}
      data-player-address={String(player.address)}
      aria-current={isSelected ? "true" : undefined}
      className={clsx(
        "relative flex w-full mb-1 overflow-visible rounded-lg border border-transparent bg-black/20 transition-all duration-200",
        player.isUser && !isSelected && "border-gold/50 bg-gold/20",
        !isSelected && !hasRankUp && !hasRankDown && "hover:border-gold/20 hover:bg-brown/40",
        isSelected && "border-amber-300/80 bg-amber-400/20 shadow-[0_0_14px_rgba(223,170,84,0.45)]",
        hasRankUp && "animate-row-glow-up",
        hasRankDown && "animate-row-glow-down",
      )}
    >
      {(player.isUser || isSelected) && (
        <span
          className={clsx(
            "pointer-events-none absolute inset-y-2 left-1 w-1 rounded-full bg-gradient-to-b",
            player.isUser && !isSelected && "from-amber-200 via-gold to-amber-500 opacity-80",
            isSelected && "from-yellow via-amber-200 to-gold opacity-100 animate-slowPulse",
          )}
        />
      )}
      <div
        className={clsx(
          "grid w-full cursor-pointer items-center gap-x-3 px-3 py-2 text-xs transition-colors md:gap-x-4 md:px-4",
          gridTemplateClass,
        )}
        onClick={onSelect}
      >
        <div className="flex justify-center">
          <span
            className={clsx(
              "font-medium transition-colors",
              !isUnranked && "italic",
              isUnranked ? "text-red-400" : isSelected ? "text-lightest" : "text-gold/90",
            )}
          >
            {isUnranked ? "—" : `#${player.rank}`}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {avatarUrl && (
            <img
              className="h-7 w-7 rounded-full border border-gold/30 object-cover"
              src={avatarUrl}
              alt={`${player.name} avatar`}
            />
          )}
          <div className="min-w-0">
            <h6
              className={clsx("truncate text-sm font-semibold transition-colors", {
                "text-lightest": isSelected,
                "text-gold": !isSelected,
              })}
            >
              {player.name}
            </h6>
            {activitySummary && <span className="block text-sm text-kit-muted md:hidden">{activitySummary}</span>}
          </div>
        </div>
        {showTribeDetails ? (
          <div
            className={clsx("hidden min-w-0 truncate text-xs transition-colors md:block", {
              "text-emerald-300/90": player.guild && !isSelected,
              "text-emerald-200": player.guild && isSelected,
              "text-gold/50 italic": !player.guild && !isSelected,
              "text-gold/70 italic": !player.guild && isSelected,
            })}
          >
            {player.guild ? player.guild.name : "No Tribe"}
          </div>
        ) : null}
        <div
          className={clsx(WIDE_ONLY, "justify-center text-sm font-medium transition-colors", {
            "text-lightest": isSelected,
            "text-gold/90": !isSelected,
          })}
        >
          {tilesLabel}
        </div>
        <div
          className={clsx(WIDE_ONLY, "justify-center text-sm font-medium transition-colors", {
            "text-lightest": isSelected,
            "text-gold/90": !isSelected,
          })}
        >
          {cratesLabel}
        </div>
        <div
          className={clsx(WIDE_ONLY, "justify-center text-sm font-medium transition-colors", {
            "text-lightest": isSelected,
            "text-gold/90": !isSelected,
          })}
        >
          {riftsLabel}
        </div>
        <div
          className={clsx(WIDE_ONLY, "justify-center text-sm font-medium transition-colors", {
            "text-lightest": isSelected,
            "text-gold/90": !isSelected,
          })}
        >
          {hyperstructuresTakenLabel}
        </div>
        <div
          className={clsx(WIDE_ONLY, "justify-center text-sm font-medium transition-colors", {
            "text-lightest": isSelected,
            "text-gold/90": !isSelected,
          })}
        >
          {hyperstructuresHeldLabel}
        </div>
        <div
          className={clsx("flex items-center justify-end gap-2 text-sm font-semibold md:justify-center", {
            "text-amber-200": player.points !== null && player.points > 1000,
            "text-lightest": isSelected && player.points !== null && player.points <= 1000,
            "text-gold/90": !isSelected && player.points !== null && player.points <= 1000,
          })}
        >
          <span>{player.points === null ? "—" : currencyIntlFormat(player.points)}</span>
          {hasShareholderPoints && (
            <span
              className="text-order-brilliance text-xs"
              onMouseEnter={() =>
                setTooltip({
                  content: <div className="text-gold">Includes real-time hyperstructure shareholder points</div>,
                  position: "top",
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              ⚡
            </span>
          )}
          {player.isUser && (
            // Register unregistered shareholder points straight from the row.
            // Don't let the click bubble up to the row-select handler.
            <span onClick={(event) => event.stopPropagation()}></span>
          )}
        </div>
        {showMmr && <MmrDeltaCell delta={player.mmrDelta} />}
      </div>

      {showTribeDetails ? (
        <div className="flex items-center pr-2 min-w-[28px] justify-center">
          {!player.isUser && (
            <SemanticIcon
              name="mail"
              onClick={() => {
                whitelistPlayer(player.address);
                setTooltip(null);
              }}
              className={clsx("w-5 h-5  hover:brightness-125 transition-all duration-200", {
                "animate-pulse opacity-50 pointer-events-none": isLoading,
                "cursor-pointer": !isLoading,
              })}
              onMouseEnter={() =>
                setTooltip({
                  content: <div className="text-gold">Invite to tribe</div>,
                  position: "top",
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          )}
        </div>
      ) : null}
    </div>
  );
};
