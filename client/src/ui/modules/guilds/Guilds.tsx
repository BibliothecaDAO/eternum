import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { guilds } from "@/ui/components/navigation/Config";
import { GuildsPanel } from "@/ui/components/worldmap/guilds/GuildsPanel";

export const Guilds  = () => {
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(guilds));

  return (
    <OSWindow width="600px" onClick={() => togglePopup(guilds)} show={isOpen} title={guilds}>
      <GuildsPanel />
    </OSWindow>
  );
};
