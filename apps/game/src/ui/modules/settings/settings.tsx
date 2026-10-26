import { PROFILE_WORDS } from "@/ui/design-system/kit/words";
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
  HudButton,
  HudField,
  HudIconButton,
  HudNotice,
  HudPortrait,
  HudSetting,
  HudSlider,
  HudSwitch,
} from "@/ui/design-system/kit/hud-elements";
import { normalizeLeaderboardAddress } from "@/ui/features/social/player/finalized-blitz-leaderboard";
import { useInGameLeaderboard } from "@/ui/features/social/player/use-in-game-leaderboard";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { getGuildFromPlayerAddress } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { ContractAddress, formatExact } from "@bibliothecadao/types";

import { useState } from "react";
import { shortAddress } from "@/ui/design-system/kit/address";
import { AppSettings } from "./app-settings";
import { SettingsSection } from "./settings-section";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { NotificationSettings } from "./notification-settings";
import { VideoSettings } from "./video-settings";

export const SETTINGS_POPOVER_ID = "settings";
const effectsCategories = Object.values(AudioCategory).filter((category) => category !== AudioCategory.MUSIC);

/**
 * Player settings first; installing the app and the keys, rarely touched, come last before the session. The keys are
 * one row whose Show opens their list in Settings' place, so Settings stays one short page. A row a device cannot use
 * (Haptics where nothing vibrates, the keys on a touch-first device) is not drawn there.
 */
export const SettingsPanel = () => {
  const [shortcuts, setShortcuts] = useState(false);
  if (shortcuts) return <KeyboardShortcuts onBack={() => setShortcuts(false)} />;
  return (
    <div className="flex flex-col gap-4 p-1">
      <ProfileHeader />
      <AudioSettings />
      <SettingsSection title="Video & Graphics">
        <VideoSettings />
      </SettingsSection>
      <NextUpSettings />
      <SettingsSection title={PROFILE_WORDS.notifications}>
        <NotificationSettings />
      </SettingsSection>
      <AppSettings onShowKeys={() => setShortcuts(true)} />
      <SessionActions />
    </div>
  );
};

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
    standing && `#${standing.rank} · ${formatExact(Math.round(standing.points))} points`,
    guild,
    spectating && name && `as ${name}`,
  ].filter(Boolean);

  // Who, then where they stand, then the address to copy: two lines beside the portrait.
  return (
    <header className="flex items-center gap-3 border-b border-hud-divider pb-2">
      {address && <HudPortrait src={playerAvatarUrl(address, profile)} label={name ?? "Player"} />}
      <div className="min-w-0 flex-1">
        {session && !spectating ? (
          <UsernameEditor name={name} />
        ) : (
          <p className="truncate text-hud-title text-hud-ink">
            {spectating ? "Spectating" : (name ?? "Not signed in")}
          </p>
        )}
        <p className="flex min-w-0 items-center gap-1 text-hud-body text-hud-muted">
          {facts.length > 0 && <span className="truncate">{facts.join(" · ")} ·</span>}
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
        </p>
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
      <div className="flex min-w-0 items-center gap-1">
        <p className="truncate text-hud-title text-hud-ink">{name ?? "Choose a username"}</p>
        <HudIconButton kind="quiet" size="sm" icon="edit" label="Change username" onClick={startEditing} />
      </div>
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

/** One switch for Next up's tips: off, Next up shows only alerts (attacks, arrivals), and nothing without one. */
function NextUpSettings() {
  const { nextUpTips, setNextUpTips } = useWorldAppearanceStore();
  return (
    <SettingsSection title="Next up">
      <HudSetting name="Tips">
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
