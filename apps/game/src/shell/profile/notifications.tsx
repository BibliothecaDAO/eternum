import { LEVEL_WORDS, PROFILE_WORDS } from "@/ui/design-system/kit/words";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { AppChip, AppSetting, AppSwitch, AppTabs } from "@/ui/design-system/kit/app-elements";
import type { NotificationLevel } from "@bibliothecadao/notifications";

import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { type ThisDeviceState, useThisDevice } from "./this-device";

/**
 * The three levels the app offers (ruled), stored as the Worker's own off, important and all. The Worker also keeps
 * an older Standard between Important and All; the app offers no such level, so a stored Standard lights none of the
 * three until the player picks one, rather than claiming a level the player does not get.
 */
type Level = keyof typeof LEVEL_WORDS;
const LEVELS: Level[] = ["off", "important", "all"];
const shownLevel = (saved: NotificationLevel | undefined): Level | undefined =>
  saved === "standard" ? undefined : saved;
/** No tab chosen: a stored Standard, or the level still loading. */
const NO_LEVEL = "" as Level;

/**
 * Notifications (spec 12): three levels with the chosen one's meaning in one line (Important carries the reminder an
 * hour before a Frontier day closes), and This device as one switch. Signed out, the level is kept on this browser and
 * moves to the account at sign-in. A switch that failed turns back with the reason.
 */
export const NotificationsCard = () => {
  const { session } = useIdentitySession();
  const owner = notificationOwnerOf(session);
  const preferences = useNotificationPreferences(owner);
  const device = useThisDevice(owner);
  const level = shownLevel(preferences.saved?.level);
  const waiting = preferences.status !== "ready";
  return (
    <section className="flex flex-col gap-3">
      <div className={cn(waiting && "pointer-events-none opacity-50")}>
        <AppTabs
          label={PROFILE_WORDS.notifications}
          tabs={LEVELS.map((key) => ({ key, label: LEVEL_WORDS[key].word }))}
          value={level ?? NO_LEVEL}
          onChange={(next) => void preferences.save(next)}
        />
      </div>
      <p className="min-h-6 text-app-body text-app-muted">{level ? LEVEL_WORDS[level].line : "—"}</p>
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
