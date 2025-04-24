import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { Headline } from "@/ui/elements/headline";
import { BuildingType, CapacityConfig, ResourcesIds } from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";

export const Transfers = () => {
  return (
    <div className="space-y-8">
      <Headline>Transfers</Headline>

      <section className="space-y-4">
        <h4>Transport</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            The trade menu facilitates the transfer of resources across various map locations. Ensure you have a
            sufficient supply of donkeys to enable these transfers.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h4>Donkeys</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            Donkeys are integral to Eternum's economy, serving as the primary means of resource transportation. They
            possess a finite carrying capacity, with each resource type assigned a specific weight.
          </p>
          <p className="leading-relaxed">
            Donkey carry capacity: <strong>{configManager.getCapacityConfigKg(CapacityConfig.Donkey)} kg</strong>
          </p>
          <div className="flex mt-4 justify-center w-full gap-8 font-bold border border-gold/20 rounded-lg p-4 bg-gold/5">
            <div className="ml-2">Lords: {`${configManager.getResourceWeightKg(ResourcesIds.Lords)} kg/unit`}</div>
            <div>Food: {`${configManager.getResourceWeightKg(ResourcesIds.Wheat)} kg/unit`}</div>
            <div className="ml-2">Resource: {`${configManager.getResourceWeightKg(ResourcesIds.Wood)} kg/unit`}</div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h4>Producing Donkeys</h4>
        <div className="space-y-4 text-gray-200">
          <div className="flex gap-3 items-center">
            <img className="h-36 min-w-20" src={BUILDING_IMAGES_PATH[BuildingType.ResourceDonkey]} alt="" />
            <div className="flex flex-col">
              <p className="font-bold">Donkeys can be acquired through:</p>
              <p>
                - Production at a <span className="font-bold">market</span> facility
              </p>
              <p>
                - Acquisition via <span className="font-bold">trade</span> on the 'Lords' Market'.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
