import { useIdentitySession } from "@/hooks/context/identity-session";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { HUD_BODY, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { HUD_PILL_BUTTON } from "@/ui/design-system/atoms/overlay-surface";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { NOTIFICATION_LEVELS, NOTIFICATION_LEVEL_DESCRIPTIONS } from "@bibliothecadao/notifications";
import { useEffect, useState } from "react";
import { NotificationDeviceSettings } from "./notification-device-settings";

export function NotificationSettings() {
  const { session, status } = useIdentitySession();
  return (
    <section aria-label="Notifications" className="space-y-2">
      <h2 className={cn("font-sans", HUD_LABEL)}>Notifications</h2>
      {isExplicitSpectateSession() ? (
        <p className={HUD_BODY}>Notifications are off while spectating.</p>
      ) : status === "loading" ? (
        <p role="status" className={HUD_BODY}>
          Loading account…
        </p>
      ) : (
        <PreferenceEditor key={session?.user.id ?? "anonymous"} owner={session?.user.id ?? null} />
      )}
    </section>
  );
}

function PreferenceEditor({ owner }: { owner: string | null }) {
  const preferences = useNotificationPreferences(owner);
  const [permission, setPermission] = useState(readPermission);
  useEffect(() => {
    const refresh = () => setPermission(readPermission());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  return (
    <>
      <p className={HUD_BODY}>{owner ? "Account notification level" : "Notification level on this browser"}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Notification level">
        {NOTIFICATION_LEVELS.map((level) => (
          <button
            type="button"
            key={level}
            aria-pressed={preferences.saved?.level === level}
            disabled={preferences.status !== "ready"}
            onClick={() => {
              void preferences.save(level);
            }}
            className={cn(HUD_PILL_BUTTON, preferences.saved?.level === level && "border-gold bg-gold text-dark-brown")}
          >
            {level[0].toUpperCase() + level.slice(1)}
          </button>
        ))}
      </div>
      {preferences.saved && <p className={HUD_BODY}>{NOTIFICATION_LEVEL_DESCRIPTIONS[preferences.saved.level]}</p>}
      <p role="status" aria-live="polite" className={HUD_BODY}>
        {preferenceStatusText(preferences.status, owner)}
      </p>
      {preferences.error && (
        <p role="alert" className="text-xs text-danger">
          {preferences.error}
        </p>
      )}
      {preferences.status === "error" && (
        <button
          type="button"
          className={HUD_PILL_BUTTON}
          onClick={() => {
            void preferences.reload();
          }}
        >
          Reload preferences
        </button>
      )}
      <NotificationDeviceSettings
        owner={owner}
        preferenceReady={preferences.status === "ready" && preferences.saved?.level !== "off"}
      />
      <p className={HUD_BODY}>
        Browser permission: {permission}. Activity history and transaction errors remain visible.
      </p>
    </>
  );
}

function readPermission(): string {
  if (!window.isSecureContext || !("Notification" in window) || !("serviceWorker" in navigator)) return "unavailable";
  return Notification.permission === "default" ? "not requested" : Notification.permission;
}

function preferenceStatusText(status: "loading" | "ready" | "saving" | "error", owner: string | null): string {
  switch (status) {
    case "loading":
      return "Loading preferences…";
    case "saving":
      return "Saving…";
    case "error":
      return "Preferences are not synced. Reload before trying again.";
    case "ready":
      return owner ? "Synced with your account." : "Saved on this browser. Signing in loads your account's choices.";
  }
}
