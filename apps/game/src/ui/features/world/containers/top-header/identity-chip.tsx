import { IDENTITY_POPOVER_ID, useIdentitySession } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { resetBootstrap } from "@/init/bootstrap";
import { buildEntryHref } from "@/play/navigation/play-route";
import { getActiveWorld } from "@/runtime/world";
import { BuildingThumbs } from "@/ui/config";
import Button from "@/ui/design-system/atoms/button";
import { HUD_BODY, HUD_BODY_MUTED, HUD_HEADLINE, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Popover } from "@/ui/design-system/molecules/popover";
import { leaderboard } from "@/ui/features/world/components/config";
import { normalizeLeaderboardAddress } from "@/ui/features/social/player/finalized-blitz-leaderboard";
import { useInGameLeaderboard } from "@/ui/features/social/player/use-in-game-leaderboard";
import { IdentityLogin } from "@/ui/modules/identity/identity-login";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { ContractAddress } from "@bibliothecadao/types";
import EyeIcon from "lucide-react/dist/esm/icons/eye";
import LoaderIcon from "lucide-react/dist/esm/icons/loader-2";
import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  countOwnedStructures,
  type IdentityChipState,
  NO_OWNED_STRUCTURES,
  resolveIdentityChipState,
  shortAddress,
} from "./identity-chip-state";
import { TOP_PILL, TOP_PILL_TEXT } from "./top-pill";

const formatPoints = (points: number): string => Math.round(points).toLocaleString();

const useIdentityChipState = (): IdentityChipState => {
  const { status, session } = useIdentitySession();
  const gameplayAddress = useAccountStore((state) => state.account?.address ?? null);
  const provisioningError = useAccountStore((state) => state.provisioningError);
  const players = useWorldSlicesStore((state) => state.players);
  const structures = useWorldSlicesStore((state) => state.structures);
  const { standingsByAddress } = useInGameLeaderboard();
  const identityName = session?.user.name || null;

  return useMemo(() => {
    const owner = gameplayAddress ? ContractAddress(gameplayAddress) : null;
    return resolveIdentityChipState({
      isExplicitSpectateSession: isExplicitSpectateSession(),
      identity: { status, name: identityName },
      gameplayAccount: { address: gameplayAddress, provisioningError },
      playerName: owner === null ? null : (players.find((player) => player.address === owner)?.name ?? null),
      owned: owner === null ? NO_OWNED_STRUCTURES : countOwnedStructures(structures, owner),
      standing: owner === null ? null : (standingsByAddress.get(normalizeLeaderboardAddress(owner)) ?? null),
    });
  }, [gameplayAddress, identityName, players, provisioningError, standingsByAddress, status, structures]);
};

/**
 * The top-left identity chip: who you are in this game, in one pill, with the sign-in surface, the Play affordance
 * and the leaderboard behind one popover. It replaces the spectating pill, the rank pill and the "not logged in"
 * banner.
 */
export const IdentityChip = () => {
  const state = useIdentityChipState();
  const isOpen = usePopoverStore((popovers) => popovers.openId === IDENTITY_POPOVER_ID);

  return (
    <Popover
      id={IDENTITY_POPOVER_ID}
      ariaLabel="Identity"
      trigger={<IdentityChipTrigger state={state} isOpen={isOpen} />}
    >
      <IdentityChipPanel state={state} />
    </Popover>
  );
};

const IdentityChipTrigger = ({ state, isOpen }: { state: IdentityChipState; isOpen: boolean }) => (
  <button
    type="button"
    aria-expanded={isOpen}
    aria-label="Identity"
    className={cn(
      TOP_PILL,
      TOP_PILL_TEXT,
      "identity-chip whitespace-nowrap transition hover:bg-gold/15",
      isOpen && "border-gold/60 bg-gold/15",
    )}
  >
    <IdentityChipLabel state={state} />
  </button>
);

const IdentityChipLabel = ({ state }: { state: IdentityChipState }) => {
  switch (state.kind) {
    case "spectating":
      return (
        <>
          <EyeIcon className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
          <span>Spectating</span>
          {state.name && <Separator />}
          {state.name && <span className="max-w-[140px] truncate normal-case tracking-normal">as {state.name}</span>}
        </>
      );
    case "signed-out":
      return (
        <>
          <EyeIcon className="h-3.5 w-3.5 text-gold/70" aria-hidden="true" />
          <span>Not signed in</span>
          <Separator />
          <span className="text-gold/70">View only</span>
        </>
      );
    case "connecting":
      return (
        <>
          <LoaderIcon className="h-3.5 w-3.5 animate-spin text-gold" aria-hidden="true" />
          <span>Connecting</span>
          {state.name && <Separator />}
          {state.name && <span className="max-w-[140px] truncate normal-case tracking-normal">{state.name}</span>}
        </>
      );
    case "player":
      return (
        <>
          <img src={BuildingThumbs.guild} alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
          <span className="max-w-[140px] truncate">{state.name}</span>
          <Separator />
          <span>{formatRealmCount(state.realmCount)}</span>
          {state.standing && <Separator />}
          {state.standing && <span>#{state.standing.rank}</span>}
          {state.standing && <Separator />}
          {state.standing && <span>{formatPoints(state.standing.points)} VP</span>}
        </>
      );
  }
};

const Separator = () => <span className="text-gold/50">·</span>;

const formatRealmCount = (count: number): string => `${count} ${count === 1 ? "realm" : "realms"}`;

const IdentityChipPanel = ({ state }: { state: IdentityChipState }) => {
  const togglePopup = useUIStore((ui) => ui.togglePopup);
  const closePopover = usePopoverStore((popovers) => popovers.close);
  const openLeaderboard = useCallback(() => {
    closePopover(IDENTITY_POPOVER_ID);
    togglePopup(leaderboard);
  }, [closePopover, togglePopup]);

  return (
    <div className="flex flex-col gap-3">
      <IdentityChipPanelBody state={state} />
      <Button variant="outline" size="xs" className="w-full justify-center" onClick={openLeaderboard}>
        Leaderboard
      </Button>
    </div>
  );
};

const IdentityChipPanelBody = ({ state }: { state: IdentityChipState }) => {
  switch (state.kind) {
    case "signed-out":
      return (
        <SignInSurface>
          You are not signed in, so this game is view only. Sign in with your Starknet identity wallet to play.
        </SignInSurface>
      );
    case "connecting":
      return (
        <div className="flex flex-col gap-1">
          <span className={HUD_HEADLINE}>{state.name ?? "Signing in"}</span>
          <span className={HUD_BODY}>Preparing your gameplay account…</span>
          {state.error && <span className="text-xs text-danger">{state.error}</span>}
        </div>
      );
    case "spectating":
      return <SpectatingPanel state={state} />;
    case "player":
      return <PlayerPanel state={state} />;
  }
};

const SignInSurface = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-3">
    <span className={HUD_BODY}>{children}</span>
    <IdentityLogin className="items-start" />
  </div>
);

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

const PlayerPanel = ({ state }: { state: Extract<IdentityChipState, { kind: "player" }> }) => {
  const gameplayAddress = useAccountStore((account) => account.account?.address ?? null);

  return (
    <div className="flex flex-col gap-1">
      <span className={HUD_HEADLINE}>{state.name}</span>
      {gameplayAddress && <span className="font-mono text-[11px] text-gold/60">{shortAddress(gameplayAddress)}</span>}
      <span className={HUD_LABEL}>{formatRealmCount(state.realmCount)}</span>
      {state.standing && (
        <span className={HUD_BODY}>
          Rank #{state.standing.rank} · {formatPoints(state.standing.points)} VP
        </span>
      )}
    </div>
  );
};

/** Re-enters the active game in play intent: a fresh bootstrap without the spectate flag. */
const useEnterActiveGameAsPlayer = () => {
  const navigate = useNavigate();

  return useCallback(() => {
    const world = getActiveWorld();
    if (!world) return;
    resetBootstrap();
    navigate(buildEntryHref({ chain: world.chain, worldName: world.name, intent: "play", autoSettle: false }));
  }, [navigate]);
};
