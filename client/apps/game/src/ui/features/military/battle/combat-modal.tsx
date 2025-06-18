import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { HelpContainer } from "@/ui/features/military/components/help-container";
import { ModalContainer } from "@/ui/shared";
import { ActorType, ID } from "@bibliothecadao/types";
import { Suspense, useState } from "react";
import { AttackContainer } from "./attack-container";

enum ModalTab {
  Attack = "Attack",
  Transfer = "Transfer",
}

export const CombatModal = ({
  selected,
  target,
}: {
  selected: {
    type: ActorType;
    id: ID;
    hex: { x: number; y: number };
  };
  target: {
    type: ActorType;
    id: ID;
    hex: { x: number; y: number };
  };
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>(ModalTab.Attack);

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
            {activeTab === ModalTab.Attack ? (
              <AttackContainer attackerEntityId={selected.id} targetHex={target.hex} />
            ) : (
              <HelpContainer selected={selected} target={target} />
            )}
          </Suspense>
        </div>
      </div>
    </ModalContainer>
  );
};
