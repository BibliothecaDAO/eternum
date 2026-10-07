import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { ViewSwitch } from "@/ui/design-system/kit/view-switch";
import type { NotificationLevel } from "@bibliothecadao/notifications";

import { StateChip } from "../play/state-chip";
import { ServiceFailure } from "../service-failure";
import { LEVEL_WORDS, PROFILE_WORDS } from "../words";
import { SettingRow, SettingRows } from "./setting-row";
import { type ThisDeviceState, useThisDevice } from "./this-device";

/**
 * The three levels the app offers (ruled), stored as the Worker's own off, important and all. The Worker also keeps
 * an older Standard between Important and All; the app offers no such level, so a stored Standard lights none of the
 * three until the player picks one, rather than claiming a level the player does not get.
 */
type Level = keyof typeof LEVEL_WORDS;
const LEVELS: Level[] = ["off", "important", "all"];
export const shownLevel = (saved: NotificationLevel | undefined): Level | undefined =>
  saved === "standard" ? undefined : saved;

/**
 * Notifications (spec 12): one bell, three levels with the chosen one's meaning in one line (Important carries the
 * reminder an hour before a Frontier day closes), and This device as one switch. Signed out, the level is kept on this
 * browser and moves to the account at sign-in. A switch that failed turns back with the reason.
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
      <div className="flex justify-center">
        <KitIcon code="Bl" size={44} />
      </div>
      <div className={cn(waiting && "pointer-events-none opacity-50")}>
        <ViewSwitch
          label={PROFILE_WORDS.notifications}
          views={LEVELS.map((id) => ({ id, word: LEVEL_WORDS[id].word }))}
          lit={level}
          onChange={(next) => void preferences.save(next)}
        />
      </div>
      <p className="min-h-6 text-center text-[15px] text-kit-muted">{level ? LEVEL_WORDS[level].line : "—"}</p>
      <SettingRows>
        <SettingRow
          icon="Dv"
          name={PROFILE_WORDS.thisDevice}
          end={<DeviceEnd state={device.state} onToggle={device.toggle} />}
        />
      </SettingRows>
      {device.state === "blocked" && (
        <p className="text-center text-[15px] text-kit-amber">{PROFILE_WORDS.blockedLine}</p>
      )}
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
      return <StateChip icon="Dv" text={PROFILE_WORDS.install} />;
    case "blocked":
      return <StateChip icon="Lk" text={PROFILE_WORDS.blocked} />;
    case "unavailable":
      return <StateChip icon="Lk" />;
    case "saving":
      return <KitIcon code="Sp" size={24} className="animate-spin" />;
    default:
      return <Switch on={state === "on"} label={PROFILE_WORDS.thisDevice} onToggle={() => void onToggle()} />;
  }
};

const Switch = ({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={onToggle}
    className={cn(
      "relative h-8 w-14 shrink-0 rounded-full border-2 transition-colors",
      on ? "border-kit-gold bg-kit-gold" : "border-kit-line2 bg-kit-plate2",
    )}
  >
    <span
      className={cn(
        "absolute top-0.5 size-6 rounded-full bg-kit-cream transition-[left]",
        on ? "left-[26px]" : "left-0.5",
      )}
    />
  </button>
);
