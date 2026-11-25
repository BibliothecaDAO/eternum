import { useCompactLane } from "@/hooks/helpers/use-compact-hud";
import { useDocumentClass } from "@/hooks/use-document-class";
import { CompactHud } from "@/ui/features/world/containers/compact-hud";
import { TopHeader } from "@/ui/features/world/containers/top-header/top-header";
import { DesktopHud } from "@/ui/features/world/hud/desktop-hud";

/**
 * The Blitz and Eternum HUD: the top bar, then the desktop's columns, or below `lg` the compact HUD laid out for the
 * phone's orientation. It keeps its own type: IM FELL labels and buttons, caps, the teal surfaces (index.css).
 */
export const ArenaHud = () => {
  useDocumentClass("classic-hud");
  const lane = useCompactLane();
  return (
    <>
      <TopHeader />
      {lane ? <CompactHud lane={lane} /> : <DesktopHud />}
    </>
  );
};
