import { LEVEL_WORDS, PROFILE_WORDS } from "@/ui/design-system/kit/words";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { AppChip, AppSetting, AppSwitch, AppTabs } from "@/ui/design-system/kit/app-elements";
import { NOTIFICATION_LEVELS, type NotificationLevel } from "@bibliothecadao/notifications";

import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { levelMeaning } from "./level-meaning";
import { type ThisDeviceState, useThisDevice } from "./this-device";

/** No tab chosen while the level loads. */
const NO_LEVEL = "" as NotificationLevel;

/**
 * Notifications (spec 12): three levels with the chosen one's meaning in one line, and This device as one switch. Signed out, the level is kept on this browser and
 * moves to the account at sign-in. A switch that failed turns back with the reason.
 */
export const NotificationsCard = () => {
  const { session } = useIdentitySession();
  const owner = notificationOwnerOf(session);
  const preferences = useNotificationPreferences(owner);
  const device = useThisDevice(owner);
  const level = preferences.saved?.level;
  const waiting = preferences.status !== "ready";
  return (
    <section className="flex flex-col gap-3">
      <div className={cn(waiting && "pointer-events-none opacity-50")}>
        <AppTabs
          label={PROFILE_WORDS.notifications}
          tabs={NOTIFICATION_LEVELS.map((key) => ({ key, label: LEVEL_WORDS[key] }))}
          value={level ?? NO_LEVEL}
          onChange={(next) => void preferences.save(next)}
        />
      </div>
      {level && <p className="text-app-body text-app-muted">{levelMeaning(level)}</p>}
      <div className="-mx-5">
        <AppSetting
          icon="monitor"
          name={PROFILE_WORDS.thisDevice}
          control={<DeviceEnd state={device.state} onToggle={device.toggle} />}
        />
      </div>
      {device.state === "blocked" && <p className="text-app-body text-app-warn">{PROFILE_WORDS.blockedLine}</p>}
      {preferences.status === "error" && (
        <ServiceFailure service="notifications" error={preferences.error} retry={() => void preferences.reload()} />
      )}
      {device.failed && <ServiceFailure service="notifications" error={null} />}
    </section>
  );
};

/** The device row's end: the switch, its step while it saves, or what stands in its way. */
const DeviceEnd = ({ state, onToggle }: { state: ThisDeviceState; onToggle: () => Promise<void> }) => {
  switch (state) {
    case "install":
      return <AppChip icon="monitor">{PROFILE_WORDS.install}</AppChip>;
    case "blocked":
      return (
        <AppChip tone="warn" icon="lock">
          {PROFILE_WORDS.blocked}
        </AppChip>
      );
    case "unavailable":
      return <AppSwitch label={PROFILE_WORDS.thisDevice} checked={false} disabled />;
    case "saving":
      return <SemanticIcon name="refresh" size={24} className="animate-spin" />;
    default:
      return <AppSwitch label={PROFILE_WORDS.thisDevice} checked={state === "on"} onChange={() => void onToggle()} />;
  }
};
