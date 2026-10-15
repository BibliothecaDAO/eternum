import { usePopoverStore } from "@/hooks/store/use-popover-store";
import CircleButton from "@/ui/design-system/molecules/circle-button";
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
        className="w-[420px] overflow-y-auto"
        trigger={
          <SettingsButton
            active={openPopoverId === SETTINGS_POPOVER_ID}
            onClick={() => togglePopover(SETTINGS_POPOVER_ID)}
          />
        }
      >
        <SettingsPanel />
      </Popover>
    </div>
  );
};

export function SettingsButton({ active = false, onClick }: { active?: boolean; onClick: () => void }) {
  return (
    <CircleButton
      variant="hud"
      className="settings-selector"
      tooltipLocation="bottom"
      active={active}
      image="settings"
      label="Settings"
      aria-label="Settings"
      data-notice
      size="topbar"
      onClick={onClick}
    />
  );
}
