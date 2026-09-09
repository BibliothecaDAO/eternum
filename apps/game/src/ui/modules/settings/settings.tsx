import { AudioCategory, useAudio } from "@/audio";
import { signOutIdentitySession, useIdentitySession } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { getAvatarUrl } from "@/hooks/use-player-avatar";
import {
  readGraphicsPreferences,
  writeGraphicsPreferences,
  type GraphicsPreferences,
} from "@/three/graphics-preferences";
import { RangeInput } from "@/ui/design-system/atoms";
import { RendererDebugControl } from "@/ui/debug/renderer-debug-control";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY, HUD_HEADLINE, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { normalizeLeaderboardAddress } from "@/ui/features/social/player/finalized-blitz-leaderboard";
import { useInGameLeaderboard } from "@/ui/features/social/player/use-in-game-leaderboard";
import { CHAT_SHORTCUT } from "@/ui/features/world/containers/chat-shortcut";
import { getShortcutManager } from "@/utils/shortcuts/centralized-shortcut-manager";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { getGuildFromPlayerAddress } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useDisconnect } from "@starknet-react/core";
import { type ReactNode, useState } from "react";

export const SETTINGS_POPOVER_ID = "settings";
const effectsCategories = Object.values(AudioCategory).filter((category) => category !== AudioCategory.MUSIC);
const BUTTON = "rounded-full px-3 py-1 font-sans text-xs";

export const SettingsPanel = () => (
  <div className="flex flex-col gap-5 p-2">
    <ProfileHeader />
    <VideoSettings />
    <AudioSettings />
    <ShortcutsSection />
    <SessionActions />
  </div>
);

function ProfileHeader() {
  const { session } = useIdentitySession();
  const address = useAccountStore((state) => state.account?.address ?? null);
  const players = useWorldSlicesStore((state) => state.players);
  const { standingsByAddress } = useInGameLeaderboard();
  const {
    setup: { components },
  } = useDojo();
  const [error, setError] = useState<string | null>(null);
  const owner = address ? ContractAddress(address) : null;
  const name = (owner && players.find((player) => player.address === owner)?.name) || session?.user.name || null;
  const standing = owner === null ? null : (standingsByAddress.get(normalizeLeaderboardAddress(owner)) ?? null);
  const guild = owner === null ? null : (getGuildFromPlayerAddress(owner, components)?.name ?? null);
  const spectating = isExplicitSpectateSession();

  return (
    <header className="flex items-center gap-3 border-b border-gold/20 pb-3">
      {address && <img src={getAvatarUrl(address)} alt="" className="h-12 w-12 rounded-full border border-gold/30" />}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate", HUD_HEADLINE)}>{spectating ? "Spectating" : (name ?? "Not signed in")}</p>
        {spectating && name && <p className={cn("truncate", HUD_BODY)}>as {name}</p>}
        {address && (
          <button
            type="button"
            aria-label="Copy address"
            className="font-mono text-xs text-gold/70"
            onClick={() => navigator.clipboard.writeText(address).catch(() => setError("Could not copy address"))}
          >
            {address.slice(0, 6)}…{address.slice(-4)} ⧉
          </button>
        )}
        {standing && (
          <p className={HUD_BODY}>
            #{standing.rank} · {Math.round(standing.points).toLocaleString()} VP
          </p>
        )}
        {guild && <p className={HUD_BODY}>{guild}</p>}
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </header>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className={cn("font-sans", HUD_LABEL)}>{title}</h2>
      {children}
    </section>
  );
}
function SelectedOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(BUTTON, selected ? "bg-gold text-dark-brown" : "border border-gold/30 text-gold")}
    >
      {children}
    </button>
  );
}
function VideoSettings() {
  const preferences = readGraphicsPreferences(localStorage);
  const { reducedMotion, setReducedMotion } = useWorldAppearanceStore();
  const changeGraphics = (change: Partial<GraphicsPreferences>) => {
    writeGraphicsPreferences(localStorage, { ...preferences, ...change });
    window.location.reload();
  };
  return (
    <SettingsSection title="Video & Graphics">
      <div className="flex gap-2">
        {(["balanced", "high"] as const).map((quality) => (
          <SelectedOption
            key={quality}
            selected={preferences.quality === quality}
            onClick={() => changeGraphics({ quality })}
          >
            {quality === "high" ? "High" : "Balanced"}
          </SelectedOption>
        ))}
      </div>
      <div className="flex gap-2">
        <SelectedOption
          selected={preferences.shadows}
          onClick={() => changeGraphics({ shadows: !preferences.shadows })}
        >
          Shadows
        </SelectedOption>
        <SelectedOption selected={reducedMotion} onClick={() => setReducedMotion(!reducedMotion)}>
          Reduced motion
        </SelectedOption>
      </div>
      <RendererDebugControl className="border-0 bg-transparent px-0 py-0 backdrop-blur-none" />
    </SettingsSection>
  );
}
function AudioSettings() {
  const { setCategoryVolume, setMasterVolume, setMuted, audioState } = useAudio();
  return (
    <SettingsSection title="Audio">
      <RangeInput
        title="Master"
        value={Math.round((audioState?.masterVolume ?? 0) * 100)}
        onChange={(value) => setMasterVolume(value / 100)}
      />
      <RangeInput
        title="Music"
        value={Math.round((audioState?.categoryVolumes[AudioCategory.MUSIC] ?? 0) * 100)}
        onChange={(value) => setCategoryVolume(AudioCategory.MUSIC, value / 100)}
      />
      <RangeInput
        title="Effects"
        value={Math.round((audioState?.categoryVolumes[AudioCategory.UI] ?? 0) * 100)}
        onChange={(value) => effectsCategories.forEach((category) => setCategoryVolume(category, value / 100))}
      />
      <SelectedOption selected={audioState?.muted ?? false} onClick={() => setMuted(!audioState?.muted)}>
        Mute
      </SelectedOption>
    </SettingsSection>
  );
}

const KEY_NAMES: Record<string, string> = { Escape: "Esc" };
const formatShortcutKey = (key: string, modifiers?: { shift?: boolean; ctrl?: boolean; alt?: boolean; meta?: boolean }) =>
  [
    modifiers?.ctrl && "Ctrl",
    modifiers?.alt && "Alt",
    modifiers?.meta && "Meta",
    modifiers?.shift && "Shift",
    KEY_NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key),
  ]
    .filter(Boolean)
    .join("+");

/** Read-only: the keys the active scene has bound, plus the chat binding. */
function ShortcutsSection() {
  const bound = getShortcutManager().getShortcuts();
  const bindings = [
    ...bound.map((shortcut) => ({
      key: formatShortcutKey(shortcut.key, shortcut.modifiers),
      description: shortcut.description,
    })),
    { key: formatShortcutKey(CHAT_SHORTCUT.key), description: CHAT_SHORTCUT.description },
  ];
  return (
    <SettingsSection title="Shortcuts">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {bindings.map((binding) => (
          <div key={`${binding.key}:${binding.description}`} className="contents">
            <dt className="rounded border border-gold/30 px-1.5 text-center font-mono text-[11px] text-gold">
              {binding.key}
            </dt>
            <dd className={HUD_BODY}>{binding.description}</dd>
          </div>
        ))}
      </dl>
    </SettingsSection>
  );
}

function SessionActions() {
  const { session } = useIdentitySession();
  const { disconnectAsync } = useDisconnect();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const canSignOut = Boolean(session) && !isExplicitSpectateSession();
  const signOut = async () => {
    setPending(true);
    setError(null);
    try {
      await signOutIdentitySession(disconnectAsync);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign out failed");
    } finally {
      setPending(false);
    }
  };
  return (
    <section aria-label="Session" className="flex flex-wrap items-center gap-2 border-t border-gold/20 pt-3">
      {canSignOut && (
        <button type="button" disabled={pending} onClick={signOut} className={cn(BUTTON, "border border-gold/30 text-gold")}>
          {pending ? "Signing out…" : "Sign out"}
        </button>
      )}
      <button
        type="button"
        onClick={() => window.location.assign("/")}
        className={cn(BUTTON, "border border-gold/30 text-gold")}
      >
        Leave game
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
