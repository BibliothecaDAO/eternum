import useUIStore from "@/hooks/store/useUIStore";
import { Questing } from "../questing/Questing";
import { SettingsWindow } from "../settings/Settings";
import { Social } from "../social/Social";

export const TopMiddleNavigation = () => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  return (
    <>
      <div className="pointer-events-auto">
        <Questing entityId={structureEntityId} />
        <Social />
        <SettingsWindow />
      </div>
    </>
  );
};
