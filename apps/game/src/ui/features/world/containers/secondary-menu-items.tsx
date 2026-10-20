import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { HudIconButton } from "@/ui/design-system/kit/hud-elements";
import { Popover } from "@/ui/design-system/molecules/popover";
import { SETTINGS_POPOVER_ID, SettingsPanel } from "@/ui/modules/settings/settings";

/** The header's last slot: settings. Connection and transaction state live in the quick feed. */
export const SecondaryMenuItems = () => {
  const openPopoverId = usePopoverStore((state) => state.openId);
  const togglePopover = usePopoverStore((state) => state.toggle);

  return (
    <div className="pointer-events-auto flex h-9 max-lg:h-11 items-center">
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
