import { useUIStore } from "@/hooks/store/use-ui-store";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudPill } from "@/ui/design-system/kit/hud-elements";

export const FollowingArmyPill = () => {
  const isFollowingArmy = useUIStore((state) => state.isFollowingArmy);
  const followingArmyMessage = useUIStore((state) => state.followingArmyMessage);
  if (!isFollowingArmy) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2">
      <HudPill>
        {[
          <span key="following" className="flex items-center gap-2">
            <SemanticIcon
              name={followingArmyMessage?.toLowerCase().includes("combat") ? "military" : "eye"}
              className="h-4 w-4 animate-pulse"
            />
            {followingArmyMessage ?? "Following Army"}
          </span>,
        ]}
      </HudPill>
    </div>
  );
};
