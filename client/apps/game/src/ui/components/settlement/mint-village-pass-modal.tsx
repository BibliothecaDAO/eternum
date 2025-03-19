import Button from "@/ui/elements/button";
import { Direction, getFreeVillagePositions, getRealmNameById, ID } from "@bibliothecadao/eternum";
import { useDojo, useRealms } from "@bibliothecadao/react";
import { useMemo, useState } from "react";
import { ModalContainer } from "../modal-container";

interface MintVillagePassModalProps {
  onClose: () => void;
}

export const MintVillagePassModal = ({ onClose }: MintVillagePassModalProps) => {
  const {
    setup: {
      account: { account },
      components,
      systemCalls: { create_village },
    },
  } = useDojo();
  const realms = useRealms();
  const [selectedRealm, setSelectedRealm] = useState<{ realmId: ID; entityId: ID } | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSettleVillage = async () => {
    if (selectedRealm !== null && selectedDirection !== null) {
      setIsLoading(true);
      await create_village({
        connected_realm: selectedRealm.entityId,
        direction: selectedDirection,
        signer: account,
      }).finally(() => setIsLoading(false));
    }
    onClose();
  };

  const selectRandomRealm = () => {
    if (realms.length > 0) {
      const randomIndex = Math.floor(Math.random() * realms.length);
      setSelectedRealm({ realmId: realms[randomIndex].metadata.realm_id, entityId: realms[randomIndex].entity_id });
      setSelectedDirection(null);
    }
  };

  const directionOptions = useMemo(() => {
    if (!selectedRealm) return [];

    const freePositions = getFreeVillagePositions(selectedRealm.entityId, components);

    return Object.keys(Direction)
      .filter((key) => isNaN(Number(key)))
      .filter((dir) => {
        const direction = Direction[dir as keyof typeof Direction];
        return freePositions.some((pos) => pos.direction === direction);
      })
      .map((dir) => ({
        value: Direction[dir as keyof typeof Direction],
        label: dir.replace(/_/g, " "),
      }));
  }, [selectedRealm, components]);

  return (
    <ModalContainer size="medium" title="Mint Village Pass">
      <div className="h-full flex flex-col p-4 space-y-6">
        <div className="flex-1 overflow-auto space-y-6">
          <div className="bg-dark-brown/70 border border-gold/30 rounded-md p-4 mb-4">
            <h3 className="text-gold font-semibold mb-2">About Villages</h3>
            <p className="text-sm text-gray-300 mb-2">
              Villages are smaller settlements with fewer perks than Realms. Each Realm has 6 possible village spots
              (one in each direction).
            </p>
            <div className="flex items-center mt-2 bg-black/30 p-2 rounded border border-gold/20">
              <div className="text-gold mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-xs text-gold/80">
                Select a Realm you own and choose one of the six directions to place your village.
              </p>
            </div>
          </div>

          <div className="w-full space-y-4">
            <div className="w-full space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-gold font-semibold">Select Realm</label>
                <Button
                  onClick={selectRandomRealm}
                  className="text-xs bg-dark-brown border border-gold/30 text-gold px-2 py-1 rounded-md hover:bg-gold/20"
                >
                  Random Realm
                </Button>
              </div>
              <select
                onChange={(e) =>
                  setSelectedRealm({
                    realmId: Number(e.target.value),
                    entityId:
                      realms.find((realm) => realm.metadata.realm_id === Number(e.target.value))?.entity_id || 0,
                  })
                }
                value={selectedRealm?.realmId ?? ""}
                className="w-full p-2 pr-8 bg-dark-brown border border-gold/30 rounded-md text-gold appearance-none focus:outline-none focus:ring-0 focus:border-gold"
                style={{ backgroundPosition: "right 0.75rem center" }}
              >
                <option value="" disabled>
                  Select a Realm
                </option>
                {realms.map((realm, index) => (
                  <option key={index} value={realm.metadata.realm_id}>
                    {`Realm #${realm.metadata.realm_id} - ${getRealmNameById(realm.metadata.realm_id) || "Unnamed"}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full space-y-2">
              <label className="text-gold font-semibold">Select Direction</label>
              <select
                onChange={(e) => setSelectedDirection(e.target.value as unknown as Direction)}
                value={selectedDirection ?? ""}
                className="w-full p-2 pr-8 bg-dark-brown border border-gold/30 rounded-md text-gold appearance-none focus:outline-none focus:ring-0 focus:border-gold"
                style={{ backgroundPosition: "right 0.75rem center" }}
              >
                <option value="" disabled>
                  Select a Direction
                </option>
                {directionOptions.map((option, index) => (
                  <option key={index} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <Button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-md">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSettleVillage}
            className="flex-1"
            isPulsing={selectedRealm !== null && selectedDirection !== null}
            disabled={!(selectedRealm !== null && selectedDirection !== null)}
            isLoading={isLoading}
          >
            Mint Village Pass
          </Button>
        </div>
      </div>
    </ModalContainer>
  );
};

export default MintVillagePassModal;
