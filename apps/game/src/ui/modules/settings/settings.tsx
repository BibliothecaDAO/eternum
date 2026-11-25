import { pageNavigation } from "@/utils/page-navigation";
import { EXIT, PROFILE_WORDS, SETTINGS, SETTINGS_WORDS } from "@/ui/design-system/kit/words";
import { AudioCategory, useAudio } from "@/audio";
import {
  identityClient,
  signOutIdentitySession,
  useIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudField,
  HudNotice,
  HudPortrait,
  HudSlider,
} from "@/ui/design-system/kit/hud-elements";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { getGuildFromPlayerAddress } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { ContractAddress } from "@bibliothecadao/types";

import { useState } from "react";
import { shortAddress } from "@/ui/design-system/kit/address";
import { HowToPlayRow, useHowToPlay } from "../how-to-play";
import { AppSettings } from "./app-settings";
import { SettingsSection } from "./settings-section";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { NotificationSettings } from "./notification-settings";
import { PlaySettings } from "./play-settings";

export const SETTINGS_POPOVER_ID = "settings";
const effectsCategories = Object.values(AudioCategory).filter((category) => category !== AudioCategory.MUSIC);

type SettingsPage = "main" | "more" | "keys";

export const SettingsPanel = () => {
  const [page, setPage] = useState<SettingsPage>("main");
  if (page === "keys") return <KeyboardShortcuts />;
  if (page === "more") return <MoreSettings onBack={() => setPage("main")} onShowKeys={() => setPage("keys")} />;
  return (
    <div className="flex flex-col gap-2.5 p-1">
      <ProfileHeader />
      <AudioSliders />
      <PlaySettings />
      <footer className="flex items-center justify-between gap-2">
        <HudButton kind="secondary" onClick={() => setPage("more")}>
          {SETTINGS_WORDS.more} ›
        </HudButton>
        <SignOut />
      </footer>
    </div>
  );
};

const MoreSettings = ({ onBack, onShowKeys }: { onBack: () => void; onShowKeys: () => void }) => {
  const guide = useHowToPlay();
  return (
    <div className="flex flex-col gap-3 p-1">
      <span>
        <HudButton kind="quiet" size="sm" onClick={onBack}>
          ‹ {SETTINGS}
        </HudButton>
      </span>
      <AppSettings onShowKeys={onShowKeys} />
      <SettingsSection title={PROFILE_WORDS.notifications}>
        <NotificationSettings />
      </SettingsSection>
      <HowToPlayRow guide={guide} />
      <span>
        <HudButton kind="secondary" icon="exit" onClick={() => pageNavigation.open("/")}>
          {EXIT}
        </HudButton>
      </span>
    </div>
  );
};

function ProfileHeader() {
  const { session } = useIdentitySession();
  const address = useAccountStore((state) => state.account?.address ?? null);
  const profile = usePlayerProfile(address);
  const {
    setup: { store },
  } = useGame();
  useNativeRevision(["Guild", "GuildMember"]);
  const [error, setError] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const owner = address ? ContractAddress(address) : null;
  // The players slice already prefers the session username for the signed-in user.
  const name = profile.name;
  const guild = owner === null ? null : (getGuildFromPlayerAddress(owner, store)?.name ?? null);
  const spectating = isExplicitSpectateSession();
  const facts = [guild, spectating && name && `as ${name}`].filter(Boolean);
  const canName = Boolean(session) && !spectating;

  // Who, then where they stand, then the address to copy: two lines beside the portrait.
  return (
    <header className="flex items-center gap-3">
      {address && <HudPortrait src={playerPortraitUrl(address, profile.portrait)} label={name ?? "Player"} />}
      <div className="min-w-0 flex-1">
        {naming ? (
          <UsernameForm name={name} onDone={() => setNaming(false)} />
        ) : (
          <p className="truncate text-hud-title text-hud-ink">
            {spectating ? "Spectating" : (name ?? (canName ? "Choose a username" : "Not signed in"))}
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
      {canName && !naming && (
        <HudButton kind="secondary" icon="edit" aria-label="Change username" onClick={() => setNaming(true)}>
          {PROFILE_WORDS.name}
        </HudButton>
      )}
    </header>
  );
}

/** The username lives on the identity account; changing it here reaches players who never open the app. */
function UsernameForm({ name, onDone }: { name: string | null; onDone: () => void }) {
  const [draft, setDraft] = useState(name ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const next = draft.trim();
    if (!next || next === name) {
      onDone();
      return;
    }
    setPending(true);
    try {
      await identityClient.updateUser({ name: next });
      await useIdentitySessionStore.getState().refresh();
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change the username");
    } finally {
      setPending(false);
    }
  };

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
            if (event.key === "Escape") onDone();
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

const VolumeSlider = ({
  icon,
  label,
  value,
  onChange,
}: {
  icon: IconMeaning;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <div className="flex items-center gap-2">
    <Icon name={icon} size={22} />
    <span className="w-16 shrink-0 text-hud-body text-hud-ink">{label}</span>
    <span className="min-w-0 flex-1">
      <HudSlider label={label} value={value} max={100} onChange={onChange} />
    </span>
    <span className="w-8 text-right text-hud-body tabular-nums text-hud-ink">{value}</span>
  </div>
);

function AudioSliders() {
  const { setCategoryVolume, setMasterVolume, audioState } = useAudio();
  return (
    <section aria-label="Audio" className="flex flex-col gap-1.5">
      <VolumeSlider
        icon="volume"
        label={SETTINGS_WORDS.master}
        value={Math.round((audioState?.masterVolume ?? 0) * 100)}
        onChange={(value) => setMasterVolume(value / 100)}
      />
      <VolumeSlider
        icon="music"
        label={PROFILE_WORDS.music}
        value={Math.round((audioState?.categoryVolumes[AudioCategory.MUSIC] ?? 0) * 100)}
        onChange={(value) => setCategoryVolume(AudioCategory.MUSIC, value / 100)}
      />
      <VolumeSlider
        icon="notifications"
        label={SETTINGS_WORDS.effects}
        value={Math.round((audioState?.categoryVolumes[AudioCategory.UI] ?? 0) * 100)}
        onChange={(value) => effectsCategories.forEach((category) => setCategoryVolume(category, value / 100))}
      />
    </section>
  );
}

function SignOut() {
  const { session } = useIdentitySession();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!session || isExplicitSpectateSession()) return null;
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
    <span className="flex flex-col items-end gap-1">
      <HudButton kind="secondary" icon="exit" busy={pending ? "Signing out…" : undefined} onClick={signOut}>
        {PROFILE_WORDS.signOut}
      </HudButton>
      {error && <HudNotice tone="bad" line={error} />}
    </span>
  );
}
