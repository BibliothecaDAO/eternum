import { pageNavigation } from "@/utils/page-navigation";
import { OPENING_WORDS, PROFILE_WORDS, SETTINGS_WORDS } from "@/ui/design-system/kit/words";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { AudioCategory, useAudio } from "@/audio";
import {
  identityClient,
  signOutIdentitySession,
  useIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import {
  HudButton,
  HudField,
  HudNotice,
  HudPortrait,
  HudSetting,
  HudSlider,
  HudSwitch,
} from "@/ui/design-system/kit/hud-elements";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { getGuildFromPlayerAddress } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { ContractAddress } from "@bibliothecadao/types";

import { getGameModeId } from "@/config/game-modes";
import { hudFor } from "@/ui/layouts/hud-for";
import { useState } from "react";
import { shortAddress } from "@/ui/design-system/kit/address";
import { HowToPlayRow, useHowToPlay } from "../how-to-play";
import { AppSettings } from "./app-settings";
import { SettingsSection } from "./settings-section";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { NotificationSettings } from "./notification-settings";
import { VideoSettings } from "./video-settings";

export const SETTINGS_POPOVER_ID = "settings";
const effectsCategories = Object.values(AudioCategory).filter((category) => category !== AudioCategory.MUSIC);

export const SettingsPanel = () => {
  const [page, setPage] = useState<"main" | "more" | "keys">("main");
  if (page === "keys") return <KeyboardShortcuts />;
  if (page === "more") return <MoreSettings onBack={() => setPage("main")} onShowKeys={() => setPage("keys")} />;
  return (
    <div className="ui-settings">
      <ProfileHeader />
      <VolumeSliders />
      <MuteSwitch />
      <VideoSettings />
      <ShowEverythingSwitch />
      <footer className="ui-settings__foot">
        <HudButton kind="secondary" size="sm" onClick={() => setPage("more")}>
          {`${SETTINGS_WORDS.more} ›`}
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
      <div>
        <HudButton kind="quiet" size="sm" icon="arrow-left" onClick={onBack}>
          {SETTINGS_WORDS.back}
        </HudButton>
      </div>
      <SettingsSection title={PROFILE_WORDS.notifications}>
        <NotificationSettings />
      </SettingsSection>
      <AppSettings onShowKeys={onShowKeys} />
      <HowToPlayRow guide={guide} />
      <AddressRow />
      <div>
        <HudButton kind="secondary" onClick={() => pageNavigation.open("/")}>
          {SETTINGS_WORDS.leaveGame}
        </HudButton>
      </div>
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
  const [editing, setEditing] = useState(false);
  const owner = address ? ContractAddress(address) : null;
  const name = profile.name;
  const guild = owner === null ? null : (getGuildFromPlayerAddress(owner, store)?.name ?? null);
  const spectating = isExplicitSpectateSession();
  const canRename = Boolean(session) && !spectating;
  const facts = [guild, spectating && name && `as ${name}`].filter(Boolean);
  const shownName = canRename ? (name ?? "Choose a username") : spectating ? "Spectating" : (name ?? "Not signed in");

  return (
    <header className="ui-settings__profile">
      {address && <HudPortrait src={playerPortraitUrl(address, profile.portrait)} label={name ?? "Player"} />}
      <div className="min-w-0 flex-1">
        {editing ? (
          <UsernameForm name={name} onDone={() => setEditing(false)} />
        ) : (
          <>
            <p className="truncate text-hud-title text-hud-ink">{shownName}</p>
            <p className="truncate text-hud-label text-hud-muted">
              {[...facts, address && shortAddress(address)].filter(Boolean).join(" · ")}
            </p>
          </>
        )}
      </div>
      {canRename && !editing && (
        <HudButton kind="secondary" size="sm" icon="edit" aria-label="Change username" onClick={() => setEditing(true)}>
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

function AddressRow() {
  const address = useAccountStore((state) => state.account?.address ?? null);
  const [error, setError] = useState<string | null>(null);
  if (!address) return null;
  return (
    <>
      <HudSetting name={shortAddress(address)}>
        <HudButton
          kind="secondary"
          size="sm"
          icon="copy"
          aria-label="Copy address"
          onClick={() => navigator.clipboard.writeText(address).catch(() => setError("Could not copy address"))}
        >
          {SETTINGS_WORDS.copy}
        </HudButton>
      </HudSetting>
      {error && <HudNotice tone="bad" line={error} />}
    </>
  );
}

function ShowEverythingSwitch() {
  const { showEverything, setShowEverything } = useWorldAppearanceStore();
  if (hudFor(getGameModeId(), true) !== "frontier") return null;
  return (
    <HudSetting name={OPENING_WORDS.showEverything}>
      <HudSwitch on={showEverything} label={OPENING_WORDS.showEverything} onChange={setShowEverything} />
    </HudSetting>
  );
}

const VOLUMES = [
  { label: SETTINGS_WORDS.master, icon: "volume" },
  { label: SETTINGS_WORDS.music, icon: "music" },
  { label: SETTINGS_WORDS.effects, icon: "notifications" },
] as const satisfies readonly { label: string; icon: IconMeaning }[];

function VolumeSliders() {
  const { setCategoryVolume, setMasterVolume, audioState } = useAudio();
  const percent = (share: number | undefined) => Math.round((share ?? 0) * 100);
  const [master, music, effects] = VOLUMES;
  return (
    <div className="ui-settings__volumes">
      <VolumeSlider
        volume={master}
        value={percent(audioState?.masterVolume)}
        onChange={(value) => setMasterVolume(value / 100)}
      />
      <VolumeSlider
        volume={music}
        value={percent(audioState?.categoryVolumes[AudioCategory.MUSIC])}
        onChange={(value) => setCategoryVolume(AudioCategory.MUSIC, value / 100)}
      />
      <VolumeSlider
        volume={effects}
        value={percent(audioState?.categoryVolumes[AudioCategory.UI])}
        onChange={(value) => effectsCategories.forEach((category) => setCategoryVolume(category, value / 100))}
      />
    </div>
  );
}

function VolumeSlider({
  volume,
  value,
  onChange,
}: {
  volume: (typeof VOLUMES)[number];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="ui-settings__volume">
      <Icon name={volume.icon} size={18} />
      <span className="ui-settings__volume-name">{volume.label}</span>
      <HudSlider label={volume.label} value={value} max={100} onChange={onChange} />
      <b className="ui-settings__volume-value">{value}</b>
    </div>
  );
}

function MuteSwitch() {
  const { setMuted, audioState } = useAudio();
  return (
    <HudSetting name={SETTINGS_WORDS.mute}>
      <HudSwitch on={audioState?.muted ?? false} label={SETTINGS_WORDS.mute} onChange={setMuted} />
    </HudSetting>
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
    <>
      <HudButton kind="secondary" size="sm" icon="exit" busy={pending ? "Signing out…" : undefined} onClick={signOut}>
        {PROFILE_WORDS.signOut}
      </HudButton>
      {error && <HudNotice tone="bad" line={error} />}
    </>
  );
}
