import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { HintModalButton } from "@/ui/elements/hint-modal-button";
import { Tabs } from "@/ui/elements/tab";
import { Buildings } from "@/ui/modules/entity-details/realm/buildings";
import { Castle } from "@/ui/modules/entity-details/realm/castle";
import { copyPlayerAddressToClipboard, displayAddress } from "@/ui/utils/utils";
import {
  formatTime,
  getStructure,
  getStructureImmunityTimer,
  isStructureImmune,
  toHexString,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, StructureType } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

export const RealmVillageDetails = () => {
  const dojo = useDojo();
  const { currentBlockTimestamp } = useBlockTimestamp();
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const structure = useMemo(
    () => getStructure(structureEntityId, ContractAddress(dojo.account.account.address), dojo.setup.components),
    [structureEntityId, dojo.account.account.address, dojo.setup.components],
  );

  const isRealm = useMemo(() => {
    return structure?.structure.base.category === StructureType.Realm;
  }, [structure]);

  const isVillage = useMemo(() => {
    return structure?.structure.base.category === StructureType.Village;
  }, [structure]);

  const address = useMemo(() => {
    return toHexString(structure?.owner || 0n);
  }, [structure]);

  const [selectedTab, setSelectedTab] = useState(0);
  const tabs = useMemo(
    () => [
      {
        key: "Castle",
        label: <div className="castle-tab-selector">Overview</div>,
        component: <Castle />,
      },
      {
        key: "Buildings",
        label: <div className="buildings-tab-selector"> Buildings</div>,
        component: <Buildings structure={structure} />,
      },
    ],
    [structure],
  );

  const isImmune = useMemo(() => isStructureImmune(currentBlockTimestamp || 0), [structure, currentBlockTimestamp]);
  const timer = useMemo(
    () => getStructureImmunityTimer(structure?.structure, currentBlockTimestamp || 0),
    [structure, currentBlockTimestamp],
  );

  return (
    structure && (
      <div className="p-3 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-2xl font-bold">{structure.name}</h3>
            </div>
            <HintModalButton section={HintSection.Realm} />
          </div>
          <div className="flex justify-between items-center text-xs space-x-4 px-1 py-0.5 bg-black/50 rounded-lg px-3">
            <div className="uppercase font-medium">{structure.ownerName}</div>
            <span
              className="uppercase hover:text-white cursor-pointer transition-colors"
              onClick={() => copyPlayerAddressToClipboard(structure.owner, structure.ownerName || "")}
            >
              {displayAddress(address)}
            </span>
          </div>

          {isImmune && (
            <div
              onMouseEnter={() => {
                setTooltip({
                  content: (
                    <>
                      This structure is currently immune to attacks.
                      <br />
                      During this period, you are also unable to attack other players.
                    </>
                  ),
                  position: "top",
                });
              }}
              onMouseLeave={() => setTooltip(null)}
              className="font-bold text-lg text-green bg-green/10 px-4 py-1.5 rounded-lg animate-pulse"
            >
              Immune for: {formatTime(timer)}
            </div>
          )}
        </div>

        {(isRealm || isVillage) && (
          <Tabs
            selectedIndex={selectedTab}
            onChange={(index: number) => setSelectedTab(index)}
            variant="default"
            className="h-full"
          >
            <Tabs.List className="mb-3">
              {tabs.map((tab, index) => (
                <Tabs.Tab key={index} className="px-6 py-2">
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Tabs.Panels>
              {tabs.map((tab, index) => (
                <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
              ))}
            </Tabs.Panels>
          </Tabs>
        )}
      </div>
    )
  );
};
