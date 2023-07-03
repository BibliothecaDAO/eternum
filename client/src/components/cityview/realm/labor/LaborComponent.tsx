import React, { useEffect, useState } from 'react';
import { OrderIcon } from '../../../../elements/OrderIcon';
import Button from '../../../../elements/Button';
import { ResourceIcon } from '../../../../elements/ResourceIcon';
import { ResourcesIds, findResourceById, resources } from '../../../../constants/resources';
import { currencyFormat } from '../../../../utils/utils.jsx';
import { ReactComponent as Clock } from '../../../../assets/icons/common/clock.svg';
import { ReactComponent as Farm } from '../../../../assets/icons/common/farm.svg';
import { ReactComponent as Village } from '../../../../assets/icons/common/village.svg';

import ProgressBar from '../../../../elements/ProgressBar';
import { useDojo } from '../../../../DojoContext';
import useRealm from '../../../../hooks/store/useRealm';
import { useComponentValue } from '@dojoengine/react';
import { Utils } from '@dojoengine/core';
import { LaborConfig, Realm } from '../../../../types';

type LaborComponentProps = {
    resourceId: number
    realm: Realm | undefined
    laborConfig: LaborConfig | undefined
    onBuild: () => void;
}

export const LaborComponent = ({ resourceId, realm, laborConfig, onBuild, ...props }: LaborComponentProps) => {
    const {
        components: { Labor, Resource },
    } = useDojo();

    let realmEntityId = useRealm((state) => state.realmEntityId);
    let labor = useComponentValue(Labor, Utils.getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]))
    let resource = useComponentValue(Resource, Utils.getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]))

    // time until the next possible harvest (that happens every 7200 seconds (2hrs))
    // if labor balance is less than current time, then there is no time to next harvest
    let timeLeftToHarvest: number | undefined;
    if (labor && laborConfig && labor.last_harvest > 0) {
        if (labor.balance > Date.now() / 1000) {
            timeLeftToHarvest = Date.now() / 1000 - labor.last_harvest
            timeLeftToHarvest = laborConfig.base_labor_units - (timeLeftToHarvest % laborConfig.base_labor_units)
        }
    }

    // if the labor balance does not exist or is lower than the current time, 
    // then there is no labor left
    let laborLeft: number | undefined;
    if (labor && labor.balance > Date.now() / 1000) {
        laborLeft = labor.balance - Date.now() / 1000;
    } else {
        laborLeft = 0;
    }

    const [state, setState] = useState();

    useEffect(() => { }, []);

    return (
        <div className='relative flex flex-col border rounded-md border-gray-gold text-xxs text-gray-gold'>
            <div className='absolute top-0 left-0 flex items-center px-1 italic border border-t-0 border-l-0 text-white/70 rounded-tl-md bg-black/60 rounded-br-md border-gray-gold'>
                {findResourceById(resourceId)?.trait}
            </div>
            <div className='grid grid-cols-6'>
                <img src={`/images/resources/${resourceId}.jpg`} className='object-cover w-full h-full rounded-md' />
                <div className='flex flex-col w-full h-full col-span-5 p-2 text-white/70'>
                    <div className='flex items-center mb-2'>
                        <ResourceIcon resource={findResourceById(resourceId)?.trait as any} size='sm' />
                        <div className='ml-2 text-xs font-bold text-white'>{currencyFormat(resource ? resource.balance : 0)}</div>
                        <div className='flex items-center ml-auto'>
                            {(resourceId == ResourcesIds['Wheat'] || resourceId == ResourcesIds['Fish']) && <Village />}
                            {resourceId == ResourcesIds['Wheat'] && <div className='px-2'>{`${labor ? labor.multiplier : 0}/${realm?.cities}`}</div>}
                            {resourceId == ResourcesIds['Fish'] && <div className='px-2'>{`${labor ? labor.multiplier : 0}/${realm?.harbors}`}</div>}
                            <Button variant='outline' className='px-2 py-1' onClick={onBuild}>Build</Button>
                        </div>
                    </div>
                    <ProgressBar rounded progress={laborConfig && timeLeftToHarvest ? 100 - timeLeftToHarvest / laborConfig.base_labor_units * 100 : 0} className='bg-white' />
                    <div className='flex items-center mt-2'>
                        <><Clock />
                            <div className='ml-1 italic text-white/70'>{laborLeft ? `${formatTimeLeft(laborLeft)} left` : 'No Labor'}</div></>

                        <div className='flex items-center mx-auto text-white/70'>
                            {laborConfig && labor ? `+${calculateProductivity(laborConfig.base_resources_per_cycle, labor.multiplier, laborConfig.base_labor_units).toFixed(2)}` : '+0'}
                            <ResourceIcon containerClassName='mx-0.5' className='!w-[12px]' resource={findResourceById(resourceId)?.trait as any} size='xs' />
                            /h
                        </div>

                        <><ResourceIcon resource={findResourceById(resourceId)?.trait as any} size='xs' className='!w-[12px]' />
                            <div className='mx-1 text-brilliance'>{`+${labor && laborConfig ? calculateNextHarvest(labor.last_harvest, labor.multiplier, laborConfig.base_labor_units, laborConfig.base_resources_per_cycle) : 0}`}</div></>
                        <Button className='!px-[6px] !py-[2px] text-xxs' variant='success' onClick={() => { }}>Harvest</Button>
                    </div>
                </div>
            </div>
        </div >
    );
};


const formatTimeLeft = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${hours}h:${minutes}m`;
};

const calculateProductivity = (resources_per_cycle: number, multiplier: number, cycle_length: number): number => {
    let productivity = resources_per_cycle * multiplier / cycle_length;
    // in hours
    return productivity * 3600;
}

// calculates how much you will have when you click on harvest
const calculateNextHarvest = (last_harvest: number, multiplier: number, cycle_length: number, resources_per_cycle: number): number => {
    let next_harvest = (Date.now() / 1000 - last_harvest) * multiplier / cycle_length * resources_per_cycle;
    // remove what you cannot harvest yet
    let rest = next_harvest % cycle_length;
    // in seconds
    return Number((next_harvest - rest).toFixed(2));
}
