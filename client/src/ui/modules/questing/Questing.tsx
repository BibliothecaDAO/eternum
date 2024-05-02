import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { quests } from "@/ui/components/navigation/Config";
import { useDojo } from "@/hooks/context/DojoContext";
import Button from "@/ui/elements/Button";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useState } from "react";

export const Questing = ({ entityId }: { entityId: bigint | undefined }) => {
  const { togglePopup } = useUIStore();
  const isOpen = useUIStore((state) => state.isPopupOpen(quests));

  const {
    setup: {
      systemCalls: { mint_starting_resources },
      components: { HasClaimedStartingResources },
    },
    account: { account },
  } = useDojo();

  const claimButtons = [
    {
      title: "Common Food Supplies",
      config_id: "1",
    },
    {
      title: "Common Resources",
      config_id: "2",
    },
    {
      title: "Uncommon Resources",
      config_id: "3",
    },
    {
      title: "Rare Resources",
      config_id: "4",
    },
    {
      title: "Epic Resources",
      config_id: "5",
    },
    {
      title: "Legendary Resources",
      config_id: "6",
    },
    {
      title: "Mythic Resources",
      config_id: "7",
    },
    {
      title: "Donkeys + Lords ",
      config_id: "8",
    },
    {
      title: "Starting Army",
      config_id: "9",
    },
  ];

  const [isLoading, setIsLoading] = useState(false);

  const handleClaimResources = async (config_id: string) => {
    setIsLoading(true); // Start loading
    try {
      await mint_starting_resources({
        signer: account,
        config_id: config_id,
        realm_entity_id: entityId || "0",
      });
    } catch (error) {
      console.error("Failed to claim resources:", error);
    } finally {
      setIsLoading(false); // Stop loading regardless of success or failure
    }
  };

  return (
    <OSWindow onClick={() => togglePopup(quests)} show={isOpen} title={quests}>
      <div className="p-4">
        <h5>Claiming</h5>
        <div className="flex flex-col mt-3 space-y-2">
          {claimButtons.map((button, index) => {
            const hasClaimed = getComponentValue(
              HasClaimedStartingResources,
              getEntityIdFromKeys([BigInt(entityId || 0), BigInt(button.config_id)]),
            );

            return (
              <Button
                key={index}
                variant="primary"
                isLoading={isLoading}
                disabled={!!hasClaimed || isLoading}
                onClick={() => handleClaimResources(button.config_id)}
              >
                {hasClaimed ? "Claimed " : "Claim "}
                {button.title}
              </Button>
            );
          })}
        </div>
        <div className="my-3">
          <h5>Bonus</h5>
          Use your Army to find Earthenshards! You will need these...
        </div>
      </div>
    </OSWindow>
  );
};
