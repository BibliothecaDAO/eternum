import { ModalContainer } from "@/ui/components/modal-container";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { ID } from "@bibliothecadao/eternum";
import { Suspense, useState } from "react";
import { CombatContainer } from "./combat-container";
import { HelpContainer } from "./help-container";
import { RaidContainer } from "./raid-container";

enum ModalTab {
  Combat = "Combat",
  Raid = "Raid",
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
      <div className="production-modal-selector container mx-auto  h-full rounded-2xl relative flex flex-col">
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-200px)]">
          <Suspense fallback={<LoadingAnimation />}>
            {activeTab === ModalTab.Combat ? (
              <CombatContainer attackerEntityId={attackerEntityId} targetHex={targetHex} />
            ) : activeTab === ModalTab.Raid ? (
              <RaidContainer attackerEntityId={attackerEntityId} targetHex={targetHex} />
            ) : (
              <HelpContainer selectedEntityId={attackerEntityId} targetHex={targetHex} />
            )}
          </Suspense>
        </div>
      </div>
    </ModalContainer>
  );
};
