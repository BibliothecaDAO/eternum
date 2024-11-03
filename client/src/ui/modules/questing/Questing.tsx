import useUIStore from "@/hooks/store/useUIStore";
import { quests } from "@/ui/components/navigation/Config";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { QuestPanel } from "@/ui/components/quest/QuestPanel";
import { ID } from "@bibliothecadao/eternum";

export const Questing = ({ entityId }: { entityId: ID | undefined }) => {
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(quests));

  return (
    <OSWindow width="600px" onClick={() => togglePopup(quests)} show={isOpen} title={quests}>
      <QuestPanel entityId={entityId} />
    </OSWindow>
  );
};
