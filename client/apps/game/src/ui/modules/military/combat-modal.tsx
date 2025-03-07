import { ModalContainer } from "@/ui/components/modal-container";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { ID } from "@bibliothecadao/eternum";
import { Suspense, useState } from "react";
import { CombatContainer } from "./combat-container";
import { HelpContainer } from "./help-container";

enum ModalTab {
  Combat = "Combat",
  Transfer = "Transfer",
}

export const CombatModal = ({
  attackerEntityId,
  targetHex,
}: {
  attackerEntityId: ID;
  targetHex: { x: number; y: number };
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>(ModalTab.Combat);

  return (
    <ModalContainer size="large">
      <div className="production-modal-selector container border mx-auto bg-dark border-gold/30 h-full rounded-2xl relative">
        {/* Tab Selection */}
        <div className="flex justify-center border-b border-gold/30">
          <div className="flex">
            {Object.values(ModalTab).map((tab) => (
              <button
                key={tab}
                className={`px-6 py-3 text-lg font-semibold ${
                  activeTab === tab ? "text-gold border-b-2 border-gold" : "text-gold/50 hover:text-gold/70"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="h-full col-span-12 w-full">
          <Suspense fallback={<LoadingAnimation />}>
            {activeTab === ModalTab.Combat ? (
              <CombatContainer attackerEntityId={attackerEntityId} targetHex={targetHex} />
            ) : (
              <HelpContainer selectedEntityId={attackerEntityId} targetHex={targetHex} />
            )}
          </Suspense>
        </div>
      </div>
    </ModalContainer>
  );
};
