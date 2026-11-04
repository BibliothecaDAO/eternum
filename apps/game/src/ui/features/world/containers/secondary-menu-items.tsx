import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { HudIconButton } from "@/ui/design-system/kit/hud-elements";
import { Popover } from "@/ui/design-system/molecules/popover";
import { PROFILE_WORDS } from "@/ui/design-system/kit/words";
import { useHowToPlay } from "@/ui/modules/how-to-play";
import { SETTINGS_POPOVER_ID, SettingsPanel } from "@/ui/modules/settings/settings";

/**
 * The header's last slot: How to play (the game's guide on the docs site, in a new tab), then Settings. Connection and
 * transaction state live in the quick feed.
 */
export const SecondaryMenuItems = () => {
  const openPopoverId = usePopoverStore((state) => state.openId);
  const togglePopover = usePopoverStore((state) => state.toggle);
  const guide = useHowToPlay();

  return (
    <div className="pointer-events-auto flex h-9 max-lg:h-11 items-center gap-1">
      <HudIconButton icon="guide" label={PROFILE_WORDS.howToPlay} href={guide} />
      <Popover
        id={SETTINGS_POPOVER_ID}
        ariaLabel="Settings"
        align="end"
        className="w-hud-settings overflow-y-auto"
        trigger={
          <HudIconButton
            icon="settings"
            label="Settings"
            aria-expanded={openPopoverId === SETTINGS_POPOVER_ID}
            onClick={() => togglePopover(SETTINGS_POPOVER_ID)}
          />
        }
      >
        <SettingsPanel />
      </Popover>
    </div>
  );
};
