import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { useThisDevice, type ThisDeviceState } from "@/shell/profile/this-device";
import { LEVEL_WORDS, PROFILE_WORDS } from "@/shell/words";
import { failureLine } from "@/ui/design-system/kit/failure-lines";
import { HudChip, HudLoading, HudNotice, HudSelect, HudSetting, HudSwitch } from "@/ui/design-system/kit/hud-elements";
import type { NotificationLevel } from "@bibliothecadao/notifications";

/**
 * Notifications in the game's Settings, on the HUD sheet: the same three levels and This device as the profile's
 * card, read and saved through the same hooks. A stored Standard (an older level the app no longer offers) shows no
 * level until the player picks one.
 */
type Level = keyof typeof LEVEL_WORDS;
const LEVELS: Level[] = ["off", "important", "all"];
const shownLevel = (saved: NotificationLevel | undefined): Level | undefined =>
  saved === "standard" ? undefined : saved;

export const NotificationSettings = () => {
  const { session } = useIdentitySession();
  const owner = notificationOwnerOf(session);
  const preferences = useNotificationPreferences(owner);
  const device = useThisDevice(owner);
  const level = shownLevel(preferences.saved?.level);
  return (
    <>
      <HudSetting name={PROFILE_WORDS.notifications} about={level ? LEVEL_WORDS[level].line : undefined}>
        <HudSelect<Level | "">
          label={PROFILE_WORDS.notifications}
          value={level ?? ""}
          options={[
            ...(level ? [] : [{ value: "" as const, label: "—", disabled: true }]),
            ...LEVELS.map((id) => ({ value: id, label: LEVEL_WORDS[id].word })),
          ]}
          disabled={preferences.status !== "ready"}
          onChange={(next) => next && void preferences.save(next)}
        />
      </HudSetting>
      <HudSetting name={PROFILE_WORDS.thisDevice}>
        <DeviceEnd state={device.state} onToggle={device.toggle} />
      </HudSetting>
      {device.state === "blocked" && <HudNotice tone="warn" line={PROFILE_WORDS.blockedLine} />}
      {preferences.status === "error" && (
        <HudNotice tone="bad" line={failureLine("notifications")} retry={() => void preferences.reload()} />
      )}
      {device.failed && <HudNotice tone="bad" line={failureLine("notifications")} />}
    </>
  );
};

/** The device row's end: the switch, its step while it saves, or what stands in its way. */
const DeviceEnd = ({ state, onToggle }: { state: ThisDeviceState; onToggle: () => Promise<void> }) => {
  switch (state) {
    case "install":
      return <HudChip>{PROFILE_WORDS.install}</HudChip>;
    case "blocked":
      return <HudChip tone="warn">{PROFILE_WORDS.blocked}</HudChip>;
    case "unavailable":
      return <HudChip>—</HudChip>;
    case "saving":
      return <HudLoading line="" />;
    default:
      return <HudSwitch on={state === "on"} label={PROFILE_WORDS.thisDevice} onChange={() => void onToggle()} />;
  }
};
