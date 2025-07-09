import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { divideByPrecision } from "@bibliothecadao/eternum";
import { findResourceById, getRelicInfo, ID, RelicRecipientType, ResourcesIds } from "@bibliothecadao/types";
import { useMemo } from "react";

interface RelicCardProps {
  resourceId: ID;
  amount: number;
  entityId: ID;
  entityType: RelicRecipientType;
  onActivate?: (resourceId: ID, amount: number) => void;
}

export const RelicCard = ({ resourceId, amount, entityId, entityType, onActivate }: RelicCardProps) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const relicInfo = useMemo(() => {
    return getRelicInfo(resourceId as ResourcesIds);
  }, [resourceId]);

  const resourceName = useMemo(() => {
    return findResourceById(resourceId)?.trait || "Unknown Relic";
  }, [resourceId]);

  const isCompatible = useMemo(() => {
    if (!relicInfo) return false;
    return (
      (entityType === RelicRecipientType.Explorer && relicInfo.activation === "Army") ||
      (entityType === RelicRecipientType.Structure && relicInfo.activation === "Structure")
    );
  }, [relicInfo, entityType]);

  const handleClick = () => {
    if (!isCompatible || !onActivate) return;

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
        ${isCompatible ? "cursor-pointer hover:bg-gold/10 transition-all duration-200" : "opacity-60"}
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
                        relicInfo.activation === "Army"
                          ? "bg-red-600/20 text-red-400"
                          : "bg-green-600/20 text-green-400"
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
                  {!isCompatible && (
                    <div className="text-red-400 text-xs font-semibold">
                      This relic cannot be activated by{" "}
                      {entityType === RelicRecipientType.Explorer ? "armies" : "structures"}
                    </div>
                  )}
                  {isCompatible && (
                    <div className="text-green-400 text-xs font-semibold">Click to activate this relic</div>
                  )}
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
        <div className="font-semibold text-gold truncate">{resourceName}</div>
        <div className="text-sm text-gold/70">Amount: {currencyFormat(divideByPrecision(amount), 0)}</div>
        {relicInfo && (
          <div className="text-xs text-gold/50 mt-1">
            {relicInfo.activation} • Level {relicInfo.level}
          </div>
        )}
      </div>

      {isCompatible && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="w-full h-full animate-pulse bg-gold/5 rounded-lg" />
        </div>
      )}
    </div>
  );
};
