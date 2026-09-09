import { AudioCategory, useAudio } from "@/audio";
import { signOutIdentitySession, useIdentitySession } from "@/hooks/context/identity-session";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import {
  readGraphicsPreferences,
  writeGraphicsPreferences,
  type GraphicsPreferences,
} from "@/three/graphics-preferences";
import { RangeInput } from "@/ui/design-system/atoms";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { useDisconnect } from "@starknet-react/core";
import { type ReactNode, useState } from "react";

export const SETTINGS_POPOVER_ID = "settings";
const effectsCategories = Object.values(AudioCategory).filter((category) => category !== AudioCategory.MUSIC);

export const SettingsPanel = () => (
  <div className="flex flex-col gap-5 p-2">
    <SettingsIdentity />
    <VideoSettings />
    <AudioSettings />
    <SettingsSection title="Game">
      <button
        type="button"
        onClick={() => window.location.assign("/")}
        className="rounded-full border border-gold/30 px-3 py-1 text-xs text-gold"
      >
        Leave game
      </button>
    </SettingsSection>
  </div>
);

function SettingsIdentity() {
  const { session } = useIdentitySession();
  const { disconnectAsync } = useDisconnect();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const address = session?.user.id;
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
    <header className="flex flex-col gap-2 border-b border-gold/20 pb-3">
      <span className={HUD_LABEL}>{session?.user.name || "Spectating"}</span>
      {address && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Copy address"
            className="font-mono text-xs text-gold/70"
            onClick={() => navigator.clipboard.writeText(address).catch(() => setError("Could not copy address"))}
          >
            {address.slice(0, 6)}…{address.slice(-4)} ⧉
          </button>
          <button type="button" disabled={pending} onClick={signOut} className="text-xs text-gold">
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </header>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className={HUD_LABEL}>{title}</h2>
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
      className={cn(
        "rounded-full px-3 py-1 text-xs",
        selected ? "bg-gold text-dark-brown" : "border border-gold/30 text-gold",
      )}
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
      <div className="space-y-2">
        <span className="text-xs text-gold/70">Quality preset</span>
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
