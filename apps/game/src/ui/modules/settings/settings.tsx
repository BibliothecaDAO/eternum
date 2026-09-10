import { AudioCategory, useAudio } from "@/audio";
import { signOutIdentitySession, useIdentitySession } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { playerAvatarUrl, usePlayerProfile } from "@/hooks/use-player-profile";
import {
  readGraphicsPreferences,
  writeGraphicsPreferences,
  type GraphicsPreferences,
} from "@/three/graphics-preferences";
import { readRenderMode, RENDER_MODE_OPTIONS, type RenderMode, writeRenderMode } from "@/three/render-profile";
import { RendererDebugControl } from "@/ui/debug/renderer-debug-control";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY, HUD_HEADLINE, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { HUD_PILL_BUTTON } from "@/ui/design-system/atoms/overlay-surface";
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

export const SettingsPanel = () => (
  <div className="flex flex-col gap-4 p-1">
    <ProfileHeader />
    <VideoSettings />
    <AudioSettings />
    <ShortcutsSection />
    <SessionActions />
  </div>
);

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

function ProfileHeader() {
  const address = useAccountStore((state) => state.account?.address ?? null);
  const profile = usePlayerProfile(address);
  const { standingsByAddress } = useInGameLeaderboard();
  const {
    setup: { components },
  } = useDojo();
  const [error, setError] = useState<string | null>(null);
  const owner = address ? ContractAddress(address) : null;
  // The players slice already prefers the session username for the signed-in user.
  const name = profile.name;
  const standing = owner === null ? null : (standingsByAddress.get(normalizeLeaderboardAddress(owner)) ?? null);
  const guild = owner === null ? null : (getGuildFromPlayerAddress(owner, components)?.name ?? null);
  const spectating = isExplicitSpectateSession();
  const facts = [
    standing && `#${standing.rank} · ${Math.round(standing.points).toLocaleString()} VP`,
    guild,
    spectating && name && `as ${name}`,
  ].filter(Boolean);

  return (
    <header className="flex items-center gap-3 border-b border-gold/20 pb-3">
      {address && (
        <img src={playerAvatarUrl(address, profile)} alt="" className="h-10 w-10 rounded-full border border-gold/30" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className={cn("truncate", HUD_HEADLINE)}>{spectating ? "Spectating" : (name ?? "Not signed in")}</p>
          {address && (
            <button
              type="button"
              aria-label="Copy address"
              className="shrink-0 font-mono text-[11px] text-gold/60"
              onClick={() => navigator.clipboard.writeText(address).catch(() => setError("Could not copy address"))}
            >
              {shortAddress(address)} ⧉
            </button>
          )}
        </div>
        {facts.length > 0 && <p className={cn("truncate", HUD_BODY)}>{facts.join(" · ")}</p>}
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
    <section aria-label={title} className="space-y-2">
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
      className={cn(HUD_PILL_BUTTON, selected && "border-gold bg-gold text-dark-brown")}
    >
      {children}
    </button>
  );
}
function VideoSettings() {
  const preferences = readGraphicsPreferences(localStorage);
  const renderMode = readRenderMode(localStorage);
  const { reducedMotion, setReducedMotion } = useWorldAppearanceStore();
  const changeGraphics = (change: Partial<GraphicsPreferences>) => {
    writeGraphicsPreferences(localStorage, { ...preferences, ...change });
    window.location.reload();
  };
  const changeRenderMode = (mode: RenderMode) => {
    writeRenderMode(localStorage, mode);
    window.location.reload();
  };
  return (
    <SettingsSection title="Video & Graphics">
      <div className="flex flex-wrap gap-2">
        {(["balanced", "high"] as const).map((quality) => (
          <SelectedOption
            key={quality}
            selected={preferences.quality === quality}
            onClick={() => changeGraphics({ quality })}
          >
            {quality === "high" ? "High" : "Balanced"}
          </SelectedOption>
        ))}
        {RENDER_MODE_OPTIONS.map((option) => (
          <SelectedOption
            key={option.mode}
            selected={renderMode === option.mode}
            onClick={() => changeRenderMode(option.mode)}
          >
            {option.label}
          </SelectedOption>
        ))}
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
      <RendererDebugControl diagnostics={false} className="border-0 bg-transparent px-0 py-0 backdrop-blur-none" />
    </SettingsSection>
  );
}

function VolumeSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid grid-cols-[4rem_1fr_2.5rem] items-center gap-2">
      <span className={HUD_BODY}>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        aria-label={label}
        className="w-full accent-gold"
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className={cn("text-right tabular-nums", HUD_BODY)}>{value}</span>
    </label>
  );
}
function AudioSettings() {
  const { setCategoryVolume, setMasterVolume, setMuted, audioState } = useAudio();
  return (
    <SettingsSection title="Audio">
      <VolumeSlider
        label="Master"
        value={Math.round((audioState?.masterVolume ?? 0) * 100)}
        onChange={(value) => setMasterVolume(value / 100)}
      />
      <VolumeSlider
        label="Music"
        value={Math.round((audioState?.categoryVolumes[AudioCategory.MUSIC] ?? 0) * 100)}
        onChange={(value) => setCategoryVolume(AudioCategory.MUSIC, value / 100)}
      />
      <VolumeSlider
        label="Effects"
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
const formatShortcutKey = (
  key: string,
  modifiers?: { shift?: boolean; ctrl?: boolean; alt?: boolean; meta?: boolean },
) =>
  [
    modifiers?.ctrl && "Ctrl",
    modifiers?.alt && "Alt",
    modifiers?.meta && "Meta",
    modifiers?.shift && "Shift",
    KEY_NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key),
  ]
    .filter(Boolean)
    .join("+");

/** Read-only: one line per bound key (both scenes bind the same keys), plus the chat binding. */
function ShortcutsSection() {
  const bound = getShortcutManager().getShortcuts();
  // One row per key; a key bound differently per scene lists each meaning once.
  const bindings = new Map<string, string[]>();
  for (const shortcut of [...bound, CHAT_SHORTCUT]) {
    const key = formatShortcutKey(shortcut.key, "modifiers" in shortcut ? shortcut.modifiers : undefined);
    const meanings = bindings.get(key) ?? [];
    if (!meanings.includes(shortcut.description)) meanings.push(shortcut.description);
    bindings.set(key, meanings);
  }
  return (
    <SettingsSection title="Shortcuts">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {[...bindings].map(([key, meanings]) => (
          <div key={key} className="contents">
            <dt className="rounded border border-gold/30 px-1.5 text-center font-mono text-[11px] text-gold">{key}</dt>
            <dd className={cn("truncate", HUD_BODY)}>{meanings.join(" · ")}</dd>
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
        <button type="button" disabled={pending} onClick={signOut} className={HUD_PILL_BUTTON}>
          {pending ? "Signing out…" : "Sign out"}
        </button>
      )}
      <button type="button" onClick={() => window.location.assign("/")} className={HUD_PILL_BUTTON}>
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
