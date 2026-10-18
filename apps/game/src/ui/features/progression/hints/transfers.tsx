import { HudPanel } from "@/ui/design-system/kit/hud-elements";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { buildingMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Headline } from "@/ui/design-system/molecules";
import { configManager } from "@bibliothecadao/eternum";
import { BuildingType, CapacityConfig, ResourcesIds } from "@bibliothecadao/types";

export const Transfers = () => {
  return (
    <div className="space-y-8">
      <Headline>Transfers</Headline>

      <section className="space-y-4">
        <h4>Transport</h4>
        <div className="space-y-4">
          <p className="leading-relaxed">
            The trade menu facilitates the transfer of resources across various map locations. Ensure you have a
            sufficient supply of donkeys to enable these transfers.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h4>Donkeys</h4>
        <div className="space-y-4">
          <p className="leading-relaxed">
            Donkeys are integral to Realms's economy, serving as the primary means of resource transportation. They
            possess a finite carrying capacity, with each resource type assigned a specific weight.
          </p>
          <p className="leading-relaxed">
            Donkey carry capacity: <strong>{configManager.getCapacityConfigKg(CapacityConfig.Donkey)} kg</strong>
          </p>
          <HudPanel collapsible={false}>
            <div className="flex w-full justify-center gap-8 text-hud-strong">
              <span>Lords: {`${configManager.getResourceWeightKg(ResourcesIds.Lords)} kg/unit`}</span>
              <span>Food: {`${configManager.getResourceWeightKg(ResourcesIds.Wheat)} kg/unit`}</span>
              <span>Resource: {`${configManager.getResourceWeightKg(ResourcesIds.Wood)} kg/unit`}</span>
            </div>
          </HudPanel>
        </div>
      </section>

      <section className="space-y-4">
        <h4>Producing Donkeys</h4>
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <SemanticIcon className="h-36 min-w-20" name={buildingMeaning(BuildingType.ResourceDonkey)} alt="" />
            <div className="flex flex-col">
              <p className="text-hud-strong">Donkeys can be acquired through:</p>
              <p>
                - Production at a <strong>market</strong> facility
              </p>
              <p>
                - Acquisition via <strong>trade</strong> on the 'Lords' Market'.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
