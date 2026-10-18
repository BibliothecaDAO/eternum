import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { identityUsername, IDENTITY_POPOVER_ID, useIdentitySession } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { isAccountStatePrompt } from "@/hooks/context/gameplay-account-sync";
import { AccountStatePrompt } from "@/shell/account-state";
import { useRealmsPlayer } from "@/shell/herald";
import { useRequestSignIn } from "@/shell/sign-in/sign-in-route";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useFactView } from "@/hooks/use-fact-view";
import { usePlayers } from "@/hooks/use-player-profile";
import { gameStructuresView } from "@/sync/fact-views";
import { buildEntryHref } from "@/play/navigation/play-route";
import { getActiveGame } from "@/runtime/world";
import { HudButton, HudPill } from "@/ui/design-system/kit/hud-elements";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Popover } from "@/ui/design-system/molecules/popover";
import { normalizeLeaderboardAddress } from "@/ui/features/social/player/finalized-blitz-leaderboard";
import { useInGameLeaderboard } from "@/ui/features/social/player/use-in-game-leaderboard";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { ContractAddress, formatExact, formatPoints } from "@bibliothecadao/types";

import { type ReactNode, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  countOwnedStructures,
  type IdentityChipState,
  type IdentityStanding,
  NO_OWNED_STRUCTURES,
  resolveIdentityChipState,
} from "./identity-chip-state";
import { LEADERBOARD_POPOVER_ID, LeaderboardSurface } from "@/ui/features/social/components/social-board";
import { useSocialStore } from "@/ui/features/social/components/use-social-store";
import { usePointsGoal } from "@/ui/features/world/hud/points-goal";

const useIdentityChipState = (): IdentityChipState => {
  const { status, session } = useIdentitySession();
  const gameplayAddress = useAccountStore((state) => state.account?.address ?? null);
  const provisioningError = useAccountStore((state) => state.provisioningError);
  const players = usePlayers();
  const structures = useFactView(gameStructuresView);
  const { standingsByAddress } = useInGameLeaderboard();
  // The player's account is known from the session alone, before (or without) joining it on this shard: a spectator
  // who owns realms here is counted as their owner, and offered Play.
  const { data: player } = useRealmsPlayer();

  return useMemo(() => {
    const owner = player ? ContractAddress(player) : null;
    return resolveIdentityChipState({
      isExplicitSpectateSession: isExplicitSpectateSession(),
      identity: { status, name: identityUsername(session) },
      gameplayAccount: { address: gameplayAddress, provisioningError },
      playerName: owner === null ? null : (players.find((player) => player.address === owner)?.name ?? null),
      owned: owner === null ? NO_OWNED_STRUCTURES : countOwnedStructures(structures, owner),
      standing: owner === null ? null : (standingsByAddress.get(normalizeLeaderboardAddress(owner)) ?? null),
    });
  }, [gameplayAddress, player, players, provisioningError, session, standingsByAddress, status, structures]);
};

/** Player identity opens the leaderboard, a session without a name opens the sign-in flow's name step; other states keep their sign-in surface. */
export const IdentityChip = ({ compact = false }: { compact?: boolean }) => {
  const state = useIdentityChipState();
  const popoverId = state.kind === "player" ? LEADERBOARD_POPOVER_ID : IDENTITY_POPOVER_ID;
  const isOpen = usePopoverStore((popovers) => popovers.openId === popoverId);

  if (state.kind === "player") return <PlayerChipTrigger state={state} isOpen={isOpen} compact={compact} />;
  const readings = compact ? [<CompactState key="state" kind={state.kind} />] : stateReadings(state);
  if (state.kind === "unnamed") {
    return <IdentityChipTrigger state={state} isOpen={isOpen} compact={compact} label="Account" readings={readings} />;
  }
  return (
    <Popover
      id={popoverId}
      ariaLabel="Account"
      trigger={
        <IdentityChipTrigger state={state} isOpen={isOpen} compact={compact} label="Account" readings={readings} />
      }
    >
      <IdentityChipPanelBody state={state} />
    </Popover>
  );
};

/** A player's chip: its hover says how the game is won and scored, and it opens the leaderboard. */
const PlayerChipTrigger = (props: {
  state: Extract<IdentityChipState, { kind: "player" }>;
  isOpen: boolean;
  compact: boolean;
}) => {
  const goal = usePointsGoal();
  const readings = usePlayerReadings(props.state.name, props.state.standing);
  return (
    <IdentityChipTrigger
      {...props}
      label={`${goal.sentence} Open the leaderboard for every score.`}
      readings={props.compact ? [<CompactPlayer key="player" state={props.state} />] : readings}
    />
  );
};

const IdentityChipTrigger = ({
  state,
  isOpen,
  compact,
  label,
  readings,
}: {
  state: IdentityChipState;
  isOpen: boolean;
  compact: boolean;
  label: string;
  readings: readonly ReactNode[];
}) => {
  const togglePopover = usePopoverStore((popovers) => popovers.toggle);
  const requestSignIn = useRequestSignIn();

  return (
    <HudPill
      label={label}
      aria-expanded={isOpen}
      onPress={() => {
        if (state.kind === "unnamed") {
          requestSignIn();
        } else if (state.kind === "player") {
          useSocialStore.setState({ selectedTab: 0, isExpanded: false });
          if (isOpen) usePopoverStore.getState().close(LEADERBOARD_POPOVER_ID);
          else usePopoverStore.getState().openSurface({ id: LEADERBOARD_POPOVER_ID, content: <LeaderboardSurface /> });
        } else {
          togglePopover(IDENTITY_POPOVER_ID);
        }
      }}
      className={cn("pointer-events-auto min-w-0 max-w-full whitespace-nowrap", compact && "gap-1.5 px-2")}
    >
      {readings}
    </HudPill>
  );
};

const CompactPlayer = ({ state }: { state: Extract<IdentityChipState, { kind: "player" }> }) => (
  <span className="flex min-w-0 items-center gap-1.5">
    <span className="min-w-0 truncate">{state.name}</span>
    {state.standing && <span className="shrink-0 text-hud-muted">#{state.standing.rank}</span>}
  </span>
);

const CompactState = ({ kind }: { kind: Exclude<IdentityChipState["kind"], "player"> }) => (
  <span className="flex min-w-0 items-center gap-1.5">
    <SemanticIcon name={kind === "connecting" ? "refresh" : "eye"} aria-hidden="true" className="h-4 w-4 shrink-0" />
    <span className="truncate">{compactLabel(kind)}</span>
  </span>
);

/** A spectator's, a signed-out viewer's or a connecting player's readings. */
const stateReadings = (state: Exclude<IdentityChipState, { kind: "player" }>): ReactNode[] => {
  switch (state.kind) {
    case "spectating":
      return [
        <span key="what" className="flex items-center gap-1.5">
          <SemanticIcon name="eye" className="h-3.5 w-3.5" aria-hidden="true" />
          Spectating
        </span>,
        ...(state.name
          ? [
              <span key="as" className="max-w-36 truncate">
                as {state.name}
              </span>,
            ]
          : []),
      ];
    case "unnamed":
      return [<span key="what">Choose a name</span>];
    case "signed-out":
      return [
        <span key="what" className="flex items-center gap-1.5">
          <SemanticIcon name="eye" className="h-3.5 w-3.5" aria-hidden="true" />
          Not signed in
        </span>,
        <span key="only" className="text-hud-muted">
          View only
        </span>,
      ];
    case "connecting":
      return [
        <span key="what" className="flex items-center gap-1.5">
          <SemanticIcon name="refresh" className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Connecting
        </span>,
        ...(state.name
          ? [
              <span key="as" className="max-w-36 truncate">
                {state.name}
              </span>,
            ]
          : []),
      ];
  }
};

/**
 * The player's name, rank and points, then the game's goal, each a reading of the top line, always on screen: the chip
 * opens the leaderboard, where the scoring is.
 */
export const usePlayerReadings = (name: string, standing: IdentityStanding | null) => {
  const goal = usePointsGoal();
  return [
    <span key="name" className="flex items-center gap-1.5">
      <SemanticIcon name="guild" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
      <span className="max-w-36 truncate">{name}</span>
    </span>,
    ...(standing
      ? [<span key="rank">#{standing.rank}</span>, <span key="points">{formatPoints(standing.points)} points</span>]
      : []),
    <span key="goal" className="text-hud-muted">
      {goal.line}
    </span>,
  ];
};

const compactLabel = (kind: Exclude<IdentityChipState["kind"], "player">): string => {
  switch (kind) {
    case "spectating":
      return "Spectating";
    case "connecting":
      return "Connecting";
    case "unnamed":
      return "Choose a name";
    case "signed-out":
      return "Sign in";
  }
};

const IdentityChipPanelBody = ({ state }: { state: Exclude<IdentityChipState, { kind: "player" | "unnamed" }> }) => {
  switch (state.kind) {
    case "signed-out":
      return (
        <SignInSurface>
          You are not signed in, so this game is view only. Sign in with your Realms account to play.
        </SignInSurface>
      );
    case "connecting":
      return (
        <div className="flex flex-col gap-1">
          <span className="text-hud-title text-hud-ink">{state.name ?? "Signing in"}</span>
          <span className="text-hud-body text-hud-ink">Preparing your gameplay account…</span>
          {isAccountStatePrompt(state.error) ? (
            <AccountStatePrompt />
          ) : (
            state.error && <span className="text-hud-label text-hud-bad">{state.error}</span>
          )}
        </div>
      );
    case "spectating":
      return <SpectatingPanel state={state} />;
  }
};

/** Signing in leaves the game for the one sign-in flow, which brings the player back to this game and view. */
const SignInSurface = ({ children }: { children: React.ReactNode }) => {
  const requestSignIn = useRequestSignIn();
  return (
    <div className="flex flex-col gap-3">
      <span className="text-hud-body text-hud-ink">{children}</span>
      <HudButton kind="primary" onClick={() => requestSignIn()}>
        Sign in
      </HudButton>
    </div>
  );
};

const SpectatingPanel = ({ state }: { state: Extract<IdentityChipState, { kind: "spectating" }> }) => {
  const enterAsPlayer = useEnterActiveGameAsPlayer();

  if (state.name === null) {
    return <SignInSurface>You are spectating this game. Sign in to play your own realms.</SignInSurface>;
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-hud-title text-hud-ink">{state.name}</span>
      <span className="text-hud-body text-hud-ink">Spectating this game.</span>
      {state.canPlay ? (
        <HudButton kind="primary" onClick={enterAsPlayer}>
          Play
        </HudButton>
      ) : (
        <span className="text-hud-body text-hud-muted">Your account owns no realm in this game.</span>
      )}
    </div>
  );
};

/** Re-enters the active game in play intent: its entry takes the booted game over without the spectate flag. */
const useEnterActiveGameAsPlayer = () => {
  const navigate = useNavigate();

  return useCallback(() => {
    const world = getActiveGame();
    if (!world) return;
    navigate(buildEntryHref({ chainId: world.chainId, gameId: world.gameId, intent: "play", autoSettle: false }));
  }, [navigate]);
};
