import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { divideByPrecision } from "@bibliothecadao/eternum";
import {
  findResourceById,
  getRelicInfo,
  ID,
  RelicActivation,
  RelicRecipientType,
  ResourcesIds,
} from "@bibliothecadao/types";
import { Sparkles } from "lucide-react";
import { useMemo } from "react";

interface RelicCardProps {
  resourceId: ID;
  amount: number;
  entityId: ID;
  entityType: RelicRecipientType;
  isActive?: boolean;
  onActivate?: (resourceId: ID, amount: number) => void;
}

export const RelicCard = ({ resourceId, amount, entityId, entityType, isActive, onActivate }: RelicCardProps) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const relicInfo = useMemo(() => {
    return getRelicInfo(resourceId as ResourcesIds);
  }, [resourceId]);

  const resourceName = useMemo(() => {
    return findResourceById(resourceId)?.trait || "Unknown Relic";
  }, [resourceId]);

  const handleClick = () => {
    if (!onActivate) return;

    import("../economy/resources/relic-activation-popup").then(({ RelicActivationPopup }) => {
      const recipientType =
        entityType === RelicRecipientType.Explorer ? RelicRecipientType.Explorer : RelicRecipientType.Structure;

      toggleModal(
        <RelicActivationPopup
          structureEntityId={entityId}
          recipientType={recipientType}
          relicId={resourceId}
          relicBalance={divideByPrecision(amount)}
          onClose={() => toggleModal(null)}
        />,
      );
    });
  };

  return (
    <div
      className={`
        relative flex items-center gap-3 p-3 bg-gold/5 rounded-lg border border-gold/10
        cursor-pointer hover:bg-gold/10 transition-all duration-200
        ${isActive ? "bg-purple-500/20 border-purple-500/50 animate-pulse" : ""}
      `}
      onClick={handleClick}
      onMouseEnter={() =>
        setTooltip({
          content: (
            <div className="space-y-2 max-w-64">
              <div className="font-bold text-gold">{resourceName}</div>
              {relicInfo && (
                <>
                  <div className="text-sm">{relicInfo.effect}</div>
                  <div className="flex gap-2 flex-wrap">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        relicInfo.type === "Stamina"
                          ? "bg-green-600/20 text-green-400"
                          : relicInfo.type === "Damage"
                            ? "bg-red-600/20 text-red-400"
                            : relicInfo.type === "Damage Reduction"
                              ? "bg-blue-600/20 text-blue-400"
                              : relicInfo.type === "Exploration"
                                ? "bg-purple-600/20 text-purple-400"
                                : relicInfo.type === "Production"
                                  ? "bg-yellow-600/20 text-yellow-400"
                                  : "bg-gray-600/20 text-gray-400"
                      }`}
                    >
                      {relicInfo.type}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        relicInfo.activation === RelicActivation.Army
                          ? "bg-red-600/20 text-red-400"
                          : relicInfo.activation === RelicActivation.Structure
                            ? "bg-green-600/20 text-green-400"
                            : "bg-orange-600/20 text-orange-400"
                      }`}
                    >
                      {relicInfo.activation}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        relicInfo.level === 2 ? "bg-purple-600/20 text-purple-400" : "bg-blue-600/20 text-blue-400"
                      }`}
                    >
                      Level {relicInfo.level}
                    </span>
                  </div>
                  <div className="text-gold/80 text-xs font-semibold">Click to view this relic</div>
                </>
              )}
            </div>
          ),
          position: "top",
        })
      }
      onMouseLeave={() => setTooltip(null)}
    >
      <ResourceIcon resource={ResourcesIds[resourceId]} size="md" withTooltip={false} className="shrink-0" />

      <div className="flex-1 min-w-0">
        <div className={`font-semibold truncate flex items-center gap-1 ${isActive ? "text-purple-300" : "text-gold"}`}>
          {resourceName}
          {isActive && <Sparkles className="h-3 w-3 text-purple-400 animate-pulse" />}
        </div>
        <div className={`text-sm ${isActive ? "text-purple-200" : "text-gold/70"}`}>
          Amount: {currencyFormat(amount, 0)}
        </div>
        {relicInfo && (
          <div className={`text-xs mt-1 ${isActive ? "text-purple-200/70" : "text-gold/50"}`}>
            {relicInfo.activation} • Level {relicInfo.level}
            {isActive && " • ACTIVE"}
          </div>
        )}
      </div>
    </div>
  );
};
