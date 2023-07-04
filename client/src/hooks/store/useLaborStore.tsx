// TODO: figure out how to store the calculation results of Labor 
// and make them accessible everywhere

import { useComponentValue } from "@dojoengine/react";
import { useEffect  } from "react";
import { create } from "zustand";
import { useDojo } from "../../DojoContext";
import { Utils } from "@dojoengine/core";
import useBlockchainStore from "./useBlockchainStore";
import { Labor, LaborConfig } from "../../types"
import { LABOR_CONFIG_ID } from "../../constants/labor";
import { calculateNextHarvest, calculateProductivity } from "../../components/cityview/realm/labor/laborUtils";

export interface LaborState {
  timeLeftToHarvest: { [resourceId: number]: number };
  laborLeft: { [resourceId: number]: number };
  nextHarvest: { [resourceId: number]: number };
  laborCosts: { [resourceId: number]: { [resourceId: number]: number }[] };
  productivity: { [resourceId: number]: number };
  setLaborState: (resourceId: number, labor: Labor, laborConfig: LaborConfig, nextBlockTimestamp: number) => void;
}

export const useLaborStore = create<LaborState>((set) => ({
    timeLeftToHarvest: {},
    laborLeft: {},
    nextHarvest: {},
    laborCosts: {},
    productivity: {},
    setLaborState: (resourceId, labor, laborConfig, nextBlockTimestamp) => {
  
        let timeLeftToHarvest: number = 0;
        if (nextBlockTimestamp && labor && laborConfig && labor.last_harvest > 0) {
        if (labor.balance > nextBlockTimestamp) {
            const timeSinceLastHarvest = nextBlockTimestamp - labor.last_harvest;
            timeLeftToHarvest =
            laborConfig.base_labor_units - (timeSinceLastHarvest % laborConfig.base_labor_units);
        }
        }

        let laborLeft: number = 0;
        if (nextBlockTimestamp && labor && laborConfig && labor.balance > nextBlockTimestamp) {
            let left = labor.balance - nextBlockTimestamp;
            laborLeft = left < laborConfig.base_labor_units? 0: left;
        }

        const isFood = [254, 255].includes(resourceId);

        let nextHarvest: number = 0;
        if (labor && laborConfig && nextBlockTimestamp) {
            nextHarvest = calculateNextHarvest(
                labor.balance,
                labor.last_harvest, 
                labor.multiplier, 
                laborConfig.base_labor_units,
                isFood? laborConfig.base_food_per_cycle : laborConfig.base_resources_per_cycle, 
                nextBlockTimestamp);
        }
            
        let productivity: number = 0;
        productivity = laborLeft? calculateProductivity(isFood? laborConfig.base_food_per_cycle: laborConfig.base_resources_per_cycle, labor.multiplier, laborConfig.base_labor_units): 0;

        set((state) => ({
        timeLeftToHarvest: {
            ...state.timeLeftToHarvest,
            [resourceId]: timeLeftToHarvest,
        },
        laborLeft: {
            ...state.laborLeft,
            [resourceId]: laborLeft,
        },
        nextHarvest: {
            ...state.nextHarvest,
            [resourceId]: nextHarvest,
        },
        productivity: {
            ...state.productivity,
            [resourceId]: productivity,
        }
        }));
    },
    }));
  
  

export const InvisibleComponent = () => {
    const { setLaborState } = useLaborStore();

    const {
    components: { Labor, LaborConfig },
    } = useDojo();

    const { nextBlockTimestamp } = useBlockchainStore();
    let laborConfig = useComponentValue(LaborConfig, Utils.getEntityIdFromKeys([BigInt(LABOR_CONFIG_ID)]))

    // Loop from 1 to 28
    for (let resourceId = 1; resourceId <= 28; resourceId++) {
        let labor = useComponentValue(Labor, Utils.getEntityIdFromKeys([BigInt(0), BigInt(resourceId)]));
        useEffect(() => {
            laborConfig && nextBlockTimestamp && labor && setLaborState(resourceId, labor, laborConfig, nextBlockTimestamp);
        }, [labor, laborConfig, nextBlockTimestamp]);
    }

    // Loop for resourceIds 254 and 255
    for (let resourceId = 254; resourceId <= 255; resourceId++) {
    const labor = useComponentValue(Labor, Utils.getEntityIdFromKeys([BigInt(0), BigInt(resourceId)]));
    useEffect(() => {
        laborConfig && nextBlockTimestamp && labor && setLaborState(resourceId, labor, laborConfig, nextBlockTimestamp);
    }, [labor, nextBlockTimestamp]);
    }


  return null;
};

export default LaborState;
