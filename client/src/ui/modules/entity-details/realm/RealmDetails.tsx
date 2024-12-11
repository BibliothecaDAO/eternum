import {
  Structure,
  useIsStructureImmune,
  useStructureByEntityId,
  useStructureImmunityTimer,
} from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import useNextBlockTimestamp from "@/hooks/useNextBlockTimestamp";
import { HintSection } from "@/ui/components/hints/HintModal";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { Tabs } from "@/ui/elements/tab";
import { copyPlayerAddressToClipboard, displayAddress, formatTime, toHexString } from "@/ui/utils/utils";
import { StructureType } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { Buildings } from "./Buildings";
import { Castle } from "./Castle";

export const RealmDetails = () => {
  const { nextBlockTimestamp } = useNextBlockTimestamp();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const structure = useStructureByEntityId(structureEntityId);

  const isRealm = useMemo(() => {
    return structure?.category === StructureType[StructureType.Realm];
  }, [structure]);

  const address = useMemo(() => {
    return toHexString(structure?.owner?.address || 0n);
  }, [structure]);

  const [selectedTab, setSelectedTab] = useState(0);
  const tabs = useMemo(
    () => [
      {
        key: "Castle",
        label: <div className="castle-tab-selector">Castle</div>,
        component: <Castle />,
      },
      {
        key: "Buildings",
        label: <div className="buildings-tab-selector">Buildings</div>,
        component: <Buildings structure={structure} />,
      },
    ],
    [structure],
  );

  const isImmune = useIsStructureImmune(structure, nextBlockTimestamp || 0);
  const timer = useStructureImmunityTimer(structure as Structure, nextBlockTimestamp || 0);

  return (
    structure && (
      <div className="p-2">
        <div className="flex justify-between">
          <h3 className="text-4xl flex justify-between">
            {structure.name} <HintModalButton section={HintSection.Realm} />
          </h3>

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
              className="font-bold text-lg animate-pulse text-green"
            >
              Immune for: {formatTime(timer)}
            </div>
          )}
        </div>

        <div className="font-bold flex justify-between my-2">
          <div>
            <div> {structure.ownerName}</div>
          </div>
          <div>
            <span
              className="ml-1 hover:text-white cursor-pointer"
              onClick={() => copyPlayerAddressToClipboard(structure.owner.address, structure.ownerName)}
            >
              {displayAddress(address)}
            </span>
          </div>
        </div>

        {isRealm && (
          <Tabs
            selectedIndex={selectedTab}
            onChange={(index: number) => setSelectedTab(index)}
            variant="default"
            className="h-full"
          >
            <Tabs.List className="border border-gold/20 rounded-lg p-1">
              {tabs.map((tab, index) => (
                <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
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
