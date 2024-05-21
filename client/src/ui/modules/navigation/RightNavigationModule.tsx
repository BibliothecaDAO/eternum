import { useMemo, useState } from "react";
import { BaseContainer } from "../../containers/BaseContainer";
import { HexagonInformationPanel } from "../../components/worldmap/hexagon/HexagonInformationPanel";

import CircleButton from "@/ui/elements/CircleButton";
import Button from "@/ui/elements/Button";
import { EntityResourceTable } from "@/ui/components/resources/EntityResourceTable";
import useRealmStore from "@/hooks/store/useRealmStore";
import { BuildingThumbs } from "./LeftNavigationModule";
import useUIStore from "@/hooks/store/useUIStore";
import { banks, trade } from "@/ui/components/navigation/Config";
import { useEntities } from "@/hooks/helpers/useEntities";
import { AllResourceArrivals, ResourceArrivals } from "@/ui/components/trading/ResourceArrivals";
import { useResources } from "@/hooks/helpers/useResources";
import { ArrowRight } from "lucide-react";
import { useModal } from "@/hooks/store/useModal";
import { MarketModal } from "@/ui/components/trading/MarketModal";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "@/hooks/context/DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import { getColRowFromUIPosition, getEntityIdFromKeys } from "@/ui/utils/utils";
import { BASE_POPULATION_CAPACITY, BuildingType, STOREHOUSE_CAPACITY } from "@bibliothecadao/eternum";

enum View {
  ResourceTable,
  ResourceArrivals,
}

export const RightNavigationModule = () => {
  const [isOffscreen, setIsOffscreen] = useState(false);

  const [currentView, setCurrentView] = useState(View.ResourceTable);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const toggleOffscreen = () => {
    setIsOffscreen(!isOffscreen);
  };

  const { realmEntityId } = useRealmStore();

  const { getAllArrivalsWithResources } = useResources();

  const { toggleModal } = useModal();

  const {
    setup: {
      components: { Population, BuildingQuantityv2 },
    },
  } = useDojo();

  const population = useComponentValue(Population, getEntityIdFromKeys([BigInt(realmEntityId || "0")]));

  const storehouses = useMemo(() => {
    const quantity =
      getComponentValue(
        BuildingQuantityv2,
        getEntityIdFromKeys([BigInt(realmEntityId || "0"), BigInt(BuildingType.Storehouse)]),
      )?.value || 0;

    return quantity * STOREHOUSE_CAPACITY + STOREHOUSE_CAPACITY;
  }, []);

  return (
    <>
      <div
        className={`max-h-full transition-all duration-200 space-x-1  flex z-0 w-[400px] text-gold right-4 self-center pointer-events-auto ${
          isOffscreen ? "translate-x-[83%]" : ""
        }`}
      >
        <div className="gap-2 flex flex-col justify-center self-center">
          <div>
            <Button onClick={() => setIsOffscreen(!isOffscreen)} variant="primary">
              <ArrowRight className={`w-4 h-4 duration-200 ${isOffscreen ? "rotate-180" : ""}`} />
            </Button>
          </div>
          <div className="flex flex-col gap-2 mb-auto">
            <CircleButton
              image={BuildingThumbs.resources}
              size="xl"
              tooltipLocation="top"
              label={"Balance"}
              active={currentView === View.ResourceTable}
              onClick={() => {
                if (isOffscreen) setIsOffscreen(false);
                setCurrentView(View.ResourceTable);
              }}
            />
            <CircleButton
              className="trade-selector"
              image={BuildingThumbs.trade}
              tooltipLocation="top"
              label={"Resource Arrivals"}
              // active={isPopupOpen(trade)}
              active={currentView === View.ResourceArrivals}
              size="xl"
              onClick={() => {
                if (isOffscreen) setIsOffscreen(false);
                setCurrentView(View.ResourceArrivals);
              }}
              notification={getAllArrivalsWithResources().length}
            />
            <CircleButton
              className="trade-selector"
              image={BuildingThumbs.scale}
              tooltipLocation="top"
              label={trade}
              active={isPopupOpen(trade)}
              size="xl"
              onClick={() => {
                if (isOffscreen) setIsOffscreen(false);
                toggleModal(<MarketModal />);
              }}
            ></CircleButton>
            <CircleButton
              className="banking-selector"
              image={BuildingThumbs.banks}
              tooltipLocation="top"
              label={banks}
              active={isPopupOpen(banks)}
              size="xl"
              onClick={() => {
                if (isOffscreen) setIsOffscreen(false);
                togglePopup(banks);
              }}
            ></CircleButton>
          </div>
        </div>

        <BaseContainer className="w-full h-[80vh] overflow-y-scroll">
          {currentView === View.ResourceTable ? (
            <>
              <div className="flex justify-between">
                {population && (
                  <div
                    onMouseEnter={() => {
                      setTooltip({
                        position: "bottom",
                        content: (
                          <span className="whitespace-nowrap pointer-events-none text-sm">
                            <span>
                              {population.population} population / {population.capacity + BASE_POPULATION_CAPACITY}{" "}
                              capacity
                            </span>
                            <br />
                            <span>Build Workers huts to expand population</span>
                          </span>
                        ),
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    className="self-center text-center  px-4 py-1 second-step bg-brown text-gold border-gradient h5"
                  >
                    {population.population} / {population.capacity + BASE_POPULATION_CAPACITY} pop
                  </div>
                )}
                {storehouses && (
                  <div
                    onMouseEnter={() => {
                      setTooltip({
                        position: "bottom",
                        content: (
                          <div className="whitespace-nowrap pointer-events-none text-sm">
                            <span>This is the max per resource you can store</span>

                            <br />
                            <span>Build Storehouses to increase this.</span>
                          </div>
                        ),
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    className="self-center text-center  px-4 py-1 second-step bg-brown text-gold border-gradient h5 "
                  >
                    {storehouses.toLocaleString()} capacity
                  </div>
                )}
              </div>
              <EntityResourceTable entityId={realmEntityId} />
            </>
          ) : (
            <AllResourceArrivals entityIds={getAllArrivalsWithResources()} />
          )}
        </BaseContainer>
      </div>
    </>
  );
};
