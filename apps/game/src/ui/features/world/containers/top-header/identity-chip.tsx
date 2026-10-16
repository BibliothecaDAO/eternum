import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
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
import Button from "@/ui/design-system/atoms/button";
import { HUD_BODY, HUD_BODY_MUTED, HUD_HEADLINE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Popover } from "@/ui/design-system/molecules/popover";
import { normalizeLeaderboardAddress } from "@/ui/features/social/player/finalized-blitz-leaderboard";
import { useInGameLeaderboard } from "@/ui/features/social/player/use-in-game-leaderboard";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { ContractAddress } from "@bibliothecadao/types";

import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  countOwnedStructures,
  type IdentityChipState,
  NO_OWNED_STRUCTURES,
  resolveIdentityChipState,
} from "./identity-chip-state";
import { LEADERBOARD_POPOVER_ID, LeaderboardSurface } from "@/ui/features/social/components/social-board";
import { useSocialStore } from "@/ui/features/social/components/use-social-store";
import { TOP_PILL } from "./top-pill";

const formatPoints = (points: number): string => Math.round(points).toLocaleString();

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

  if (state.kind === "player" || state.kind === "unnamed") {
    return <IdentityChipTrigger state={state} isOpen={isOpen} compact={compact} />;
  }
  return (
    <Popover
      id={popoverId}
      ariaLabel="Identity"
      trigger={<IdentityChipTrigger state={state} isOpen={isOpen} compact={compact} />}
    >
      <IdentityChipPanelBody state={state} />
    </Popover>
  );
};

const IdentityChipTrigger = ({
  state,
  isOpen,
  compact,
}: {
  state: IdentityChipState;
  isOpen: boolean;
  compact: boolean;
}) => {
  const togglePopover = usePopoverStore((popovers) => popovers.toggle);
  const requestSignIn = useRequestSignIn();

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-label="Identity"
      onClick={() => {
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
      className={cn(
        TOP_PILL,
        HUD_LABEL_BRIGHT,
        "identity-chip min-w-0 max-w-full whitespace-nowrap transition-colors hover:bg-gold/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold",
        compact && "gap-1.5 px-2 font-sans text-xs normal-case tracking-normal",
        isOpen && "border-gold/60 bg-gold/15",
      )}
    >
      {compact ? <CompactIdentityLabel state={state} /> : <IdentityChipLabel state={state} />}
    </button>
  );
};

const CompactIdentityLabel = ({ state }: { state: IdentityChipState }) => {
  if (state.kind === "player") {
    return (
      <>
        <span className="min-w-0 truncate">{state.name}</span>
        {state.standing && <span className="shrink-0 text-gold/70">#{state.standing.rank}</span>}
      </>
    );
  }
  const Icon = state.kind === "connecting" ? ("refresh" as const) : ("eye" as const);
  const label = compactLabel(state.kind);
  return (
    <>
      <SemanticIcon name={Icon} aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </>
  );
};

const IdentityChipLabel = ({ state }: { state: IdentityChipState }) => {
  switch (state.kind) {
    case "spectating":
      return (
        <>
          <SemanticIcon name="eye" className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
          <span>Spectating</span>
          {state.name && <Separator />}
          {state.name && <span className="max-w-[140px] truncate">as {state.name}</span>}
        </>
      );
    case "unnamed":
      return <span>Choose a name</span>;
    case "signed-out":
      return (
        <>
          <SemanticIcon name="eye" className="h-3.5 w-3.5 text-gold/70" aria-hidden="true" />
          <span>Not signed in</span>
          <Separator />
          <span className="text-gold/70">View only</span>
        </>
      );
    case "connecting":
      return (
        <>
          <SemanticIcon name="refresh" className="h-3.5 w-3.5 animate-spin text-gold" aria-hidden="true" />
          <span>Connecting</span>
          {state.name && <Separator />}
          {state.name && <span className="max-w-[140px] truncate">{state.name}</span>}
        </>
      );
    case "player":
      return (
        <>
          <SemanticIcon name="guild" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
          <span className="max-w-[140px] truncate">{state.name}</span>
          {state.standing && <Separator />}
          {state.standing && <span>#{state.standing.rank}</span>}
          {state.standing && <Separator />}
          {state.standing && <span>{formatPoints(state.standing.points)} VP</span>}
        </>
      );
  }
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

const Separator = () => <span className="text-gold/50">·</span>;

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
          <span className={HUD_HEADLINE}>{state.name ?? "Signing in"}</span>
          <span className={HUD_BODY}>Preparing your gameplay account…</span>
          {isAccountStatePrompt(state.error) ? (
            <AccountStatePrompt />
          ) : (
            state.error && <span className="text-xs text-danger">{state.error}</span>
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
      <span className={HUD_BODY}>{children}</span>
      <Button className="w-full px-4 py-2" onClick={() => requestSignIn()}>
        Sign in
      </Button>
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
      <span className={HUD_HEADLINE}>{state.name}</span>
      <span className={HUD_BODY}>Spectating this game.</span>
      {state.canPlay ? (
        <Button variant="gold" size="xs" className="w-full justify-center" onClick={enterAsPlayer}>
          Play
        </Button>
      ) : (
        <span className={HUD_BODY_MUTED}>Your account owns no realm in this game.</span>
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
