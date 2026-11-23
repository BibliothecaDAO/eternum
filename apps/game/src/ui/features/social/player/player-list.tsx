import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { ContractAddress, GuildInfo, PlayerInfo } from "@bibliothecadao/types";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HudIconButton, HudTableHead, HudTableRow } from "@/ui/design-system/kit/hud-elements";
import { revealOwnPlace } from "@/ui/design-system/kit/own-place";

export interface PlayerCustom extends PlayerInfo {
  isUser: boolean;
  guild: GuildInfo | undefined;
}

interface PlayerListProps {
  players: PlayerCustom[];
  focusOwnPlayer?: boolean;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  whitelistPlayer: (address: ContractAddress) => void;
  isLoading: boolean;
}

const GRID_TEMPLATES = {
  plain: { cols: "minmax(0, 1fr)", colsWide: "260px" },
  tribe: { cols: "minmax(0, 1fr)", colsWide: "220px 140px" },
} as const;

type GridTemplate = (typeof GRID_TEMPLATES)[keyof typeof GRID_TEMPLATES];

export const PlayerList = ({
  players,
  viewPlayerInfo,
  whitelistPlayer,
  isLoading,
  focusOwnPlayer = false,
}: PlayerListProps) => {
  const [selectedPlayerAddress, setSelectedPlayerAddress] = useState<string | null>(null);
  const showTribeDetails = useGameModeConfig().ui.showGuildsTab;
  const grid = GRID_TEMPLATES[showTribeDetails ? "tribe" : "plain"];
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!selectedPlayerAddress) return;
    if (!players.some((player) => String(player.address) === selectedPlayerAddress)) setSelectedPlayerAddress(null);
  }, [players, selectedPlayerAddress]);

  const sortedPlayers = useMemo(
    () =>
      players
        .filter((player) => !player.name.includes("Central Bank"))
        .toSorted((a, b) => a.name.localeCompare(b.name)),
    [players],
  );

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
  }, [focusOwnPlayer, sortedPlayers]);

  const selectPlayer = (address: PlayerCustom["address"]) => {
    const normalized = String(address);
    setSelectedPlayerAddress(normalized);
    viewPlayerInfo(ContractAddress(normalized));
  };

  const pressRow = (player: PlayerCustom) => {
    const row = rowRefs.current.get(String(player.address).toLowerCase());
    if (player.isUser && row && revealOwnPlace(row)) return;
    selectPlayer(player.address);
  };

  const registerRowRef = useCallback((address: string, el: HTMLDivElement | null) => {
    const normalizedAddress = address.toLowerCase();
    if (el) rowRefs.current.set(normalizedAddress, el);
    else rowRefs.current.delete(normalizedAddress);
  }, []);

  return (
    <div className="flex flex-col">
      <HudTableHead cols={grid.cols} colsWide={grid.colsWide}>
        <span className="text-left text-hud-body text-hud-accent">Name</span>
        {showTribeDetails && <span className="hidden text-left text-hud-body text-hud-accent md:block">Tribe</span>}
      </HudTableHead>

      <div className="mt-1">
        {sortedPlayers.length > 0 ? (
          sortedPlayers.map((player) => {
            const normalizedAddress = String(player.address);
            return (
              <PlayerRow
                key={normalizedAddress}
                player={player}
                onSelect={() => pressRow(player)}
                whitelistPlayer={whitelistPlayer}
                isLoading={isLoading}
                showTribeDetails={showTribeDetails}
                grid={grid}
                isSelected={selectedPlayerAddress === normalizedAddress}
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
    </div>
  );
};

const PlayerRow = ({
  player,
  onSelect,
  whitelistPlayer,
  isLoading,
  showTribeDetails,
  grid,
  isSelected,
  registerRef,
}: {
  player: PlayerCustom;
  onSelect: () => void;
  whitelistPlayer: (address: ContractAddress) => void;
  isLoading: boolean;
  showTribeDetails: boolean;
  grid: GridTemplate;
  isSelected: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
}) => {
  const setTooltip = useTooltipStore((state) => state.setTooltip);
  const profile = usePlayerProfile(player.address);

  return (
    <div
      ref={registerRef}
      data-player-address={String(player.address)}
      className={clsx("mb-1 flex w-full items-center rounded-md", player.isUser ? "ui-board-own" : "relative")}
    >
      <HudTableRow
        cols={grid.cols}
        colsWide={grid.colsWide}
        label={player.name}
        selected={isSelected}
        onClick={onSelect}
      >
        <div className="flex min-w-0 items-center gap-2">
          {profile.known && (
            <img
              className="h-7 w-7 rounded-full border border-hud-line object-cover"
              src={playerPortraitUrl(player.address, profile.portrait)}
              alt={`${player.name} avatar`}
            />
          )}
          <span className="block min-w-0 truncate text-hud-strong">{player.name}</span>
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
