import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { playerAvatarUrl } from "@/hooks/use-player-profile";
import { ENABLE_LEADERBOARD_EFFECTS_MOCKUP } from "@/ui/constants";
import type { PlayerActivityBreakdown } from "@/services/leaderboard/player-activity-breakdown-service";
import {
  NEUTRAL_OWNER_NAME,
  ContractAddress,
  GuildInfo,
  PlayerInfo,
  formatExact,
  formatPoints,
} from "@bibliothecadao/types";
import clsx from "clsx";
import gsap from "gsap";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LeaderboardEffectsOverlay } from "./leaderboard-effects";
import type { MmrForecast } from "./mmr-forecast";
import { describeHyperstructureHold, type VictoryPointGrants } from "@/ui/shared/lib/victory-point-grants";
import { HudIconButton, HudTableHead, HudTableRow } from "@/ui/design-system/kit/hud-elements";
import { PlayerEffect, useLeaderboardEffects } from "./use-leaderboard-effects";

const ROW_HEIGHT = 44; // Approximate row height in pixels

export interface PlayerCustom extends PlayerInfo {
  isUser: boolean;
  isInvited: boolean;
  guild: GuildInfo | undefined;
  /** The player's registered points by activity; null while none is known that adds up to their standing. */
  activityBreakdown: PlayerActivityBreakdown | null;
  /** Hold points the total counts that are not registered yet (use-in-game-leaderboard), shown under HS held. */
  accruingHoldPoints: number;
  /** The MMR the player would gain or lose if the game ended now; null where the ledger gave none. */
  mmrDelta: number | null;
}

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
    return `${formatExact(count)} · ${formatPoints(points)}`;
  }

  if (count > 0) return formatExact(count);
  if (points > 0) return formatPoints(points);
  return "—";
};

/**
 * The table's columns: fixed widths on wide screens, so the window is exactly the table's width; MMR adds one, as wide
 * as its "if it ended now".
 */
const GRID_TEMPLATES = {
  plain: { cols: "44px minmax(0, 1fr) auto", colsWide: "48px 220px repeat(5, 96px) 80px" },
  plainMmr: { cols: "44px minmax(0, 1fr) auto auto", colsWide: "48px 220px repeat(5, 96px) 80px 112px" },
  tribe: { cols: "44px minmax(0, 1fr) auto", colsWide: "48px 200px 120px repeat(5, 96px) 80px" },
  tribeMmr: { cols: "44px minmax(0, 1fr) auto auto", colsWide: "48px 200px 120px repeat(5, 96px) 80px 112px" },
} as const;

type GridTemplate = (typeof GRID_TEMPLATES)[keyof typeof GRID_TEMPLATES];

/** A rating change as a player reads it: +26 in green, −11 in red, ±0, or a dash where the ledger gave none. */
const MmrDeltaCell = ({ delta }: { delta: number | null }) => (
  <div
    className={clsx("text-right text-hud-strong tabular-nums md:text-center", {
      "text-hud-good": delta !== null && delta > 0,
      "text-hud-bad": delta !== null && delta < 0,
      "text-hud-muted": delta === null || delta === 0,
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
    .map(([count, one, many]) => `${formatExact(count as number)} ${count === 1 ? one : many}`)
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
    // What holding earned: the points registered at checkpoints, and those accruing since, which Points counts too.
    hyperstructuresHeldPoints: (activity?.hyperstructureShare.points ?? 0) + player.accruingHoldPoints,
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
  // The rows' last order, for the next reorder to animate from; never drawn.
  const prevPositions = useRef(new Map<string, number>());
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
    if (prevPositions.current.size === 0) {
      // First render - just store positions
      const newPositions = new Map<string, number>();
      sortedPlayers.forEach((p, i) => newPositions.set(String(p.address), i));
      prevPositions.current = newPositions;
      return;
    }

    // Animate rows from old position to new
    sortedPlayers.forEach((player, index) => {
      const address = String(player.address);
      const prevIndex = prevPositions.current.get(address);

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
    prevPositions.current = newPositions;
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
      <PlayerListHeader showTribeDetails={showTribeDetails} grants={grants} mmr={mmr} grid={leaderboardGridTemplate} />

      <div className="mt-1">
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
                grid={leaderboardGridTemplate}
                isSelected={selectedPlayerAddress === normalizedAddress}
                effect={playerEffect}
                registerRef={(el) => registerRowRef(normalizedAddress, el)}
              />
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-hud-muted">
            <SemanticIcon name="person" className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-hud-body">No players found</p>
          </div>
        )}
      </div>

      {/* Effects overlay - rendered via portal */}
      <LeaderboardEffectsOverlay effects={effects} rowRefs={rowRefs} showTribeDetails={showTribeDetails} />
    </div>
  );
};

/** A column of the table: its name, and for an activity the points it grants, with the rule in full on its tip. */
interface PlayerListColumn {
  label: string;
  align: string;
  grant?: string;
  tip?: string;
}

/**
 * Each activity column carries its grant under its name, the game's scoring table where the points it counts are: a
 * one-line title over a one-line grant, the rule in full on hover.
 */
const resolveColumns = (
  showTribeDetails: boolean,
  grants: VictoryPointGrants,
  mmr: MmrForecast["status"],
): PlayerListColumn[] => {
  const each = (points: number) => `${formatExact(points)} each`;
  const activity = `${WIDE_ONLY} flex-col justify-center text-center`;
  return [
    { label: "Rank", align: "justify-center text-center" },
    { label: "Name", align: "justify-start text-left" },
    ...(showTribeDetails ? [{ label: "Tribe", align: "hidden text-left md:block" }] : []),
    { label: "Tiles", align: activity, grant: each(grants.exploreTile), tip: "Explore a tile" },
    { label: "Crates", align: activity, grant: each(grants.openRelicCrate), tip: "Open a relic crate" },
    {
      label: "Camps & Rifts",
      align: activity,
      grant: each(grants.claimCampFromBandits),
      tip: `Claim an Essence Rift or Camp from ${NEUTRAL_OWNER_NAME}`,
    },
    {
      label: "HS taken",
      align: activity,
      grant: each(grants.claimHyperstructureFromBandits),
      tip: `Claim a Hyperstructure from ${NEUTRAL_OWNER_NAME}`,
    },
    {
      label: "HS held",
      align: activity,
      ...describeHyperstructureHold(grants),
    },
    { label: "Points", align: "justify-end text-right md:justify-center md:text-center" },
    ...(mmr === "off"
      ? []
      : [
          {
            label: "MMR",
            align: "flex flex-col justify-center text-center",
            grant: mmr === "unavailable" ? "unavailable" : "if it ended now",
            tip: "The rating each player would gain or lose if the game ended with these standings, as the ledger settles it",
          },
        ]),
  ];
};

/**
 * The scoring rules where the activity columns are hidden (a phone): the same grants the wide header puts under each
 * column, in one line above the table.
 */
const ScoringRulesLine = ({ showTribeDetails, grants }: { showTribeDetails: boolean; grants: VictoryPointGrants }) => (
  <p aria-label="Scoring rules" className="px-3 pb-2 text-hud-label text-hud-muted md:hidden">
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
  grid,
}: {
  showTribeDetails: boolean;
  grants: VictoryPointGrants;
  mmr: MmrForecast["status"];
  grid: GridTemplate;
}) => {
  const setTooltip = useTooltipStore((state) => state.setTooltip);
  const columns = useMemo(() => resolveColumns(showTribeDetails, grants, mmr), [showTribeDetails, grants, mmr]);

  return (
    <HudTableHead cols={grid.cols} colsWide={grid.colsWide}>
      {columns.map(({ label, align, grant, tip }) => (
        <div
          key={label}
          className={clsx("w-full items-center", align)}
          onMouseEnter={
            tip
              ? () => setTooltip({ content: <div className="text-hud-accent">{tip}</div>, position: "top" })
              : undefined
          }
          onMouseLeave={tip ? () => setTooltip(null) : undefined}
        >
          <span className="whitespace-nowrap text-hud-body text-hud-accent">{label}</span>
          {grant && <span className="whitespace-nowrap">{grant}</span>}
        </div>
      ))}
    </HudTableHead>
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
  grid,
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
  grid: GridTemplate;
  isSelected: boolean;
  effect?: PlayerEffect;
  registerRef: (el: HTMLDivElement | null) => void;
}) => {
  const setTooltip = useTooltipStore((state) => state.setTooltip);

  const isUnranked = player.points === null || player.rank === Number.MAX_SAFE_INTEGER;
  // Without a breakdown of this standing's points (players-panel), every activity cell says it is on its way.
  const breakdownKnown = player.activityBreakdown !== null;
  const activityLabel = (count: number, points: number) => (breakdownKnown ? formatActivityValue(count, points) : "…");
  const tilesLabel = activityLabel(player.tilesExplored, player.tilesExploredPoints);
  const cratesLabel = activityLabel(player.cratesOpened, player.cratesOpenedPoints);
  const riftsLabel = activityLabel(player.riftsTaken, player.riftsTakenPoints);
  const hyperstructuresTakenLabel = activityLabel(player.hyperstructuresTaken, player.hyperstructuresTakenPoints);
  const hyperstructuresHeldLabel = activityLabel(player.hyperstructuresHeld, player.hyperstructuresHeldPoints);
  const hasShareholderPoints = player.accruingHoldPoints > 0;
  const activitySummary = breakdownKnown ? summarizeActivity(player) : "…";

  // Determine row glow based on effect
  const hasRankUp = effect && effect.rankChange < 0;
  const hasRankDown = effect && effect.rankChange > 0;

  // One line per cell, as the header's: a count and its points never break.
  const activityCell = (label: string) => (
    <div className={clsx(WIDE_ONLY, "justify-center whitespace-nowrap")}>{label}</div>
  );

  return (
    // The row's frame carries what the table row does not: the player's own row lit, and a rank change's glow.
    <div
      ref={registerRef}
      data-player-address={String(player.address)}
      className={clsx(
        "relative mb-1 flex w-full items-center rounded-md",
        player.isUser && "bg-hud-hover",
        hasRankUp && "animate-row-glow-up",
        hasRankDown && "animate-row-glow-down",
      )}
    >
      <HudTableRow
        cols={grid.cols}
        colsWide={grid.colsWide}
        label={`${player.name}: their points`}
        selected={isSelected}
        onClick={onSelect}
      >
        <span className={clsx("text-center tabular-nums", isUnranked ? "text-hud-bad" : "text-hud-muted")}>
          {isUnranked ? "—" : `#${player.rank}`}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          {avatarUrl && (
            <img
              className="h-7 w-7 rounded-full border border-hud-line object-cover"
              src={avatarUrl}
              alt={`${player.name} avatar`}
            />
          )}
          <div className="min-w-0">
            <span className="block truncate text-hud-strong">{player.name}</span>
            {activitySummary && (
              <span className="block text-hud-label text-hud-muted md:hidden">{activitySummary}</span>
            )}
          </div>
        </div>
        {showTribeDetails ? (
          <div
            className={clsx(
              "hidden min-w-0 truncate text-hud-label md:block",
              player.guild ? "text-hud-good" : "italic text-hud-cue",
            )}
          >
            {player.guild ? player.guild.name : "No Tribe"}
          </div>
        ) : null}
        {activityCell(tilesLabel)}
        {activityCell(cratesLabel)}
        {activityCell(riftsLabel)}
        {activityCell(hyperstructuresTakenLabel)}
        {activityCell(hyperstructuresHeldLabel)}
        <div className="flex items-center justify-end gap-2 text-hud-strong text-hud-gold md:justify-center">
          <span>{player.points === null ? "—" : formatExact(player.points)}</span>
          {hasShareholderPoints && (
            <span
              className="text-hud-label text-hud-good"
              onMouseEnter={() =>
                setTooltip({
                  content: <div className="text-hud-accent">Includes real-time hyperstructure shareholder points</div>,
                  position: "top",
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              ⚡
            </span>
          )}
        </div>
        {showMmr && <MmrDeltaCell delta={player.mmrDelta} />}
      </HudTableRow>

      {showTribeDetails && !player.isUser ? (
        <HudIconButton
          icon="mail"
          label="Invite to tribe"
          kind="quiet"
          disabled={isLoading}
          onClick={() => {
            whitelistPlayer(player.address);
            setTooltip(null);
          }}
        />
      ) : null}
    </div>
  );
};
