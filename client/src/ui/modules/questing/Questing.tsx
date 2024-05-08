import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { quests } from "@/ui/components/navigation/Config";
import { QuestList } from "@/ui/components/hints/HintBox";

export const Questing = ({ entityId }: { entityId: bigint | undefined }) => {
  const { togglePopup } = useUIStore();
  const isOpen = useUIStore((state) => state.isPopupOpen(quests));

  return (
    <OSWindow width="600px" onClick={() => togglePopup(quests)} show={isOpen} title={quests}>
      <QuestList />
    </OSWindow>
  );
};
