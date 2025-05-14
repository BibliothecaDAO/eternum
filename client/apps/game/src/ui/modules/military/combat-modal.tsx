import { ModalContainer } from "@/ui/components/modal-container";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { ID } from "@bibliothecadao/types";
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
    type: "explorer" | "structure";
    id: ID;
    hex: { x: number; y: number };
  };
  target: {
    type: "explorer" | "structure";
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
            <button
              className={`px-6 py-3 text-lg font-semibold text-gold border-b-2 border-gold`}
              onClick={() => setActiveTab(ModalTab.Attack)}
            >
              {ModalTab.Attack}
            </button>
            <button
              className={`px-6 py-3 text-lg font-semibold text-gold/30 cursor-not-allowed flex items-center`}
              disabled
            >
              {ModalTab.Transfer}{" "}
              <span className="ml-2 text-xs bg-gold/20 text-gold px-2 py-0.5 rounded">COMING SOON</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-200px)]">
          <Suspense fallback={<LoadingAnimation />}>
            <AttackContainer attackerEntityId={selected.id} targetHex={target.hex} />
          </Suspense>
        </div>
      </div>
    </ModalContainer>
  );
};
