import { AudioCategory, useAudio } from "@/audio";
import {
  identityClient,
  signOutIdentitySession,
  useIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
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
import {
  HudButton,
  HudChip,
  HudField,
  HudNotice,
  HudPortrait,
  HudSelect,
  HudSetting,
  HudSlider,
  HudSwitch,
} from "@/ui/design-system/kit/hud-elements";
import { normalizeLeaderboardAddress } from "@/ui/features/social/player/finalized-blitz-leaderboard";
import { useInGameLeaderboard } from "@/ui/features/social/player/use-in-game-leaderboard";
import { CHAT_SHORTCUT } from "@/ui/features/world/containers/chat-shortcut";
import { getShortcutManager } from "@/utils/shortcuts/centralized-shortcut-manager";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { getGuildFromPlayerAddress } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { ContractAddress } from "@bibliothecadao/types";

import { type ReactNode, useState } from "react";
import { PROFILE_WORDS } from "@/shell/words";
import { shortAddress } from "@/ui/design-system/kit/address";
import { InstallSetting } from "./install-setting";
import { NotificationSettings } from "./notification-settings";

export const SETTINGS_POPOVER_ID = "settings";
const effectsCategories = Object.values(AudioCategory).filter((category) => category !== AudioCategory.MUSIC);

/** Player settings first; installing the app and the renderer choice, rarely touched, come last before the session. */
export const SettingsPanel = () => (
  <div className="flex flex-col gap-4 p-1">
    <ProfileHeader />
    <AudioSettings />
    <VideoSettings />
    <NextUpSettings />
    <SettingsSection title={PROFILE_WORDS.notifications}>
      <NotificationSettings />
    </SettingsSection>
    <ShortcutsSection />
    <SettingsSection title="App">
      <InstallSetting />
    </SettingsSection>
    <RendererSettings />
    <SessionActions />
  </div>
);

function ProfileHeader() {
  const { session } = useIdentitySession();
  const address = useAccountStore((state) => state.account?.address ?? null);
  const profile = usePlayerProfile(address);
  const { standingsByAddress } = useInGameLeaderboard();
  const {
    setup: { store },
  } = useGame();
  useNativeRevision(["Guild", "GuildMember"]);
  const [error, setError] = useState<string | null>(null);
  const owner = address ? ContractAddress(address) : null;
  // The players slice already prefers the session username for the signed-in user.
  const name = profile.name;
  const standing = owner === null ? null : (standingsByAddress.get(normalizeLeaderboardAddress(owner)) ?? null);
  const guild = owner === null ? null : (getGuildFromPlayerAddress(owner, store)?.name ?? null);
  const spectating = isExplicitSpectateSession();
  const facts = [
    standing && `#${standing.rank} · ${Math.round(standing.points).toLocaleString()} points`,
    guild,
    spectating && name && `as ${name}`,
  ].filter(Boolean);

  return (
    <header className="flex items-center gap-3 border-b border-hud-divider pb-3">
      {address && <HudPortrait src={playerAvatarUrl(address, profile)} label={name ?? "Player"} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {session && !spectating ? (
            <UsernameEditor name={name} />
          ) : (
            <p className="truncate text-hud-title text-hud-ink">
              {spectating ? "Spectating" : (name ?? "Not signed in")}
            </p>
          )}
          {address && (
            <HudButton
              kind="quiet"
              size="sm"
              aria-label="Copy address"
              onClick={() => navigator.clipboard.writeText(address).catch(() => setError("Could not copy address"))}
            >
              {shortAddress(address)} ⧉
            </HudButton>
          )}
        </div>
        {facts.length > 0 && <p className="truncate text-hud-body text-hud-muted">{facts.join(" · ")}</p>}
        {error && <HudNotice tone="bad" line={error} />}
      </div>
    </header>
  );
}

/** The username lives on the identity account; changing it here reaches players who never open the app. */
function UsernameEditor({ name }: { name: string | null }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEditing = () => {
    setDraft(name ?? "");
    setError(null);
    setEditing(true);
  };
  const save = async () => {
    const next = draft.trim();
    if (!next || next === name) {
      setEditing(false);
      return;
    }
    setPending(true);
    try {
      await identityClient.updateUser({ name: next });
      await useIdentitySessionStore.getState().refresh();
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change the username");
    } finally {
      setPending(false);
    }
  };

  if (!editing) {
    return (
      <HudButton kind="quiet" icon="edit" aria-label="Change username" onClick={startEditing}>
        {name ?? "Choose a username"}
      </HudButton>
    );
  }
  return (
    <form
      className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="min-w-0 flex-1">
        <HudField
          aria-label="Username"
          autoFocus
          value={draft}
          maxLength={31}
          disabled={pending}
          onChange={setDraft}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(false);
            event.stopPropagation();
          }}
        />
      </div>
      <HudButton kind="secondary" type="submit" busy={pending ? "Saving…" : undefined}>
        Save
      </HudButton>
      {error && (
        <div className="basis-full">
          <HudNotice tone="bad" line={error} />
        </div>
      )}
    </form>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col">
      <h2 className="text-hud-label text-hud-muted">{title}</h2>
      {children}
    </section>
  );
}

const QUALITY_OPTIONS = [
  { value: "balanced", label: "Balanced" },
  { value: "high", label: "High" },
] as const;

function VideoSettings() {
  const preferences = readGraphicsPreferences(localStorage);
  const renderMode = readRenderMode(localStorage);
  const { reducedMotion, setReducedMotion, haptics, setHaptics } = useWorldAppearanceStore();
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
      <HudSetting name="Quality" about="The game reloads to apply it">
        <HudSelect
          label="Quality"
          value={preferences.quality}
          options={QUALITY_OPTIONS}
          onChange={(quality) => changeGraphics({ quality })}
        />
      </HudSetting>
      <HudSetting name="Renderer" about="The game reloads to apply it">
        <HudSelect
          label="Renderer"
          value={renderMode}
          options={RENDER_MODE_OPTIONS.map((option) => ({ value: option.mode, label: option.label }))}
          onChange={changeRenderMode}
        />
      </HudSetting>
      <HudSetting name="Shadows" about="The game reloads to apply it">
        <HudSwitch on={preferences.shadows} label="Shadows" onChange={(shadows) => changeGraphics({ shadows })} />
      </HudSetting>
      <HudSetting name="Reduced motion">
        <HudSwitch on={reducedMotion} label="Reduced motion" onChange={setReducedMotion} />
      </HudSetting>
      <HudSetting name="Haptics">
        <HudSwitch on={haptics} label="Haptics" onChange={setHaptics} />
      </HudSetting>
    </SettingsSection>
  );
}

/** One switch for Next up's tips: off, Next up shows only alerts (attacks, arrivals), and nothing without one. */
function NextUpSettings() {
  const { nextUpTips, setNextUpTips } = useWorldAppearanceStore();
  return (
    <SettingsSection title="Next up">
      <HudSetting name="Tips" about="The coach's steps; alerts always show">
        <HudSwitch on={nextUpTips} label="Next up tips" onChange={setNextUpTips} />
      </HudSetting>
    </SettingsSection>
  );
}

function VolumeSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <HudSetting name={label}>
      <span className="flex w-48 items-center gap-2">
        <HudSlider label={label} value={value} max={100} onChange={onChange} />
        <span className="w-8 text-right text-hud-body tabular-nums">{value}</span>
      </span>
    </HudSetting>
  );
}
function RendererSettings() {
  return (
    <SettingsSection title="Renderer">
      <RendererDebugControl diagnostics={false} className="border-0 bg-transparent px-0 py-0 backdrop-blur-none" />
    </SettingsSection>
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
      <HudSetting name="Mute">
        <HudSwitch on={audioState?.muted ?? false} label="Mute" onChange={setMuted} />
      </HudSetting>
    </SettingsSection>
  );
}

const KEY_NAMES: Record<string, string> = { Escape: "Esc", " ": "Space" };
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
      <dl className="flex flex-col gap-1">
        {[...bindings].map(([key, meanings]) => (
          <div key={key} className="flex items-center gap-3">
            <dt>
              <HudChip>{key}</HudChip>
            </dt>
            <dd className="min-w-0 truncate text-hud-body text-hud-ink">{meanings.join(" · ")}</dd>
          </div>
        ))}
      </dl>
    </SettingsSection>
  );
}

function SessionActions() {
  const { session } = useIdentitySession();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const canSignOut = Boolean(session) && !isExplicitSpectateSession();
  const signOut = async () => {
    setPending(true);
    setError(null);
    try {
      await signOutIdentitySession();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign out failed");
    } finally {
      setPending(false);
    }
  };
  return (
    <section aria-label="Session" className="flex flex-wrap items-center gap-2 border-t border-hud-divider pt-3">
      {canSignOut && (
        <HudButton kind="secondary" busy={pending ? "Signing out…" : undefined} onClick={signOut}>
          Sign out
        </HudButton>
      )}
      <HudButton kind="secondary" onClick={() => window.location.assign("/")}>
        Leave game
      </HudButton>
      {error && <HudNotice tone="bad" line={error} />}
    </section>
  );
}
