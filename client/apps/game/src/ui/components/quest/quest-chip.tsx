// import { QuestData } from "@bibliothecadao/eternum";

export const QuestChip = ({
  quest,
  className,
  showButtons,
}: {
  quest: any;
  className?: string;
  showButtons?: boolean;
}) => {
  // const setTooltip = useUIStore((state) => state.setTooltip);

  // const [showInventory, setShowInventory] = useState(false);
  // const [showTroopSwap, setShowTroopSwap] = useState(false);

  // const [editMode, setEditMode] = useState(false);

  // const isHome = army.isHome;

  // const [location] = useLocation();
  // const isOnMap = useMemo(() => location.includes("map"), [location]);

  return (
    <div className={`relative w-full text-gold font-bold ${className}`}>
      <div className="flex flex-col gap-2">
        <div className="text-lg font-bold text-gold">Quest</div>
      </div>
    </div>
  );
};
