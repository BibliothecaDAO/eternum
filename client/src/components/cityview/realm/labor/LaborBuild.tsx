import React, { useEffect, useMemo, useState } from 'react';
import { SecondaryPopup } from '../../../../elements/SecondaryPopup';
import Button from '../../../../elements/Button';
import { Headline } from '../../../../elements/Headline';
import { ResourceCost } from '../../../../elements/ResourceCost';
import { NumberInput } from '../../../../elements/NumberInput';
import { findResourceById } from '../../../../constants/resources';
import { ReactComponent as FishingVillages } from '../../../../assets/icons/resources/FishingVillages.svg';
import { ReactComponent as Farms } from '../../../../assets/icons/resources/Farms.svg';
import { ResourceIcon } from '../../../../elements/ResourceIcon';
import { BuildingsCount } from '../../../../elements/BuildingsCount';
import clsx from 'clsx';
import useRealmStore from '../../../../hooks/store/useRealmStore';
import { useComponentValue } from '@dojoengine/react';
import { useDojo } from '../../../../DojoContext';
import { Utils } from '@dojoengine/core';
import { LABOR_CONFIG_ID } from '../../../../constants/labor';
import useBlockchainStore from '../../../../hooks/store/useBlockchainStore';
import { unpackResources } from '../../../../utils/packedData';

type LaborBuildPopupProps = {
    resourceId: number;
    onClose: () => void;
    onBuild: () => void;
}

export const LaborBuildPopup = ({ resourceId, onClose, onBuild }: LaborBuildPopupProps) => {
    const {
        components: { Realm, LaborConfig, LaborCostResources, LaborCostAmount },
        systemCalls: { build_labor },
    } = useDojo();

    const {nextBlockTimestamp} = useBlockchainStore();

    const [state, setState] = useState();
    const [laborAmount, setLaborAmount] = useState(1);
    const [multiplier, setMultiplier] = useState(1);

    useEffect(() => {
        setMultiplier(1); // Reset the multiplier to 1 when the resourceId changes
      }, [resourceId]);

    let realmEntityId = useRealmStore((state) => state.realmEntityId);
    let realm = useComponentValue(Realm, Utils.getEntityIdFromKeys([BigInt(realmEntityId)]));

    // TODO: find a more optimized way to do this
    // let costResourcesPacked = useComponentValue(LaborCostResources, Utils.getEntityIdFromKeys([BigInt(resourceId)]))
    // calculate the costs of building/buying tools
    // let costResources: number[] = [];
    // if (costResourcesPacked) {
    //   costResources = unpackResources(
    //     BigInt(costResourcesPacked.resource_types_packed),
    //     costResourcesPacked.resource_types_count
    //   );
    // }
    let resourceCost: {resourceId: number, amount: number}[] = [
        {resourceId: 1, amount: 100}, {resourceId: 2, amount: 100}, {resourceId: 3, amount: 100},
         {resourceId: 4, amount: 100}, {resourceId: 5, amount: 100}, {resourceId: 6, amount: 100}];
    // for (const resource of costResources) {
    //     const costAmount = useComponentValue(LaborCostAmount, Utils.getEntityIdFromKeys([BigInt(resourceId), BigInt(resource)]));
    //     if (costAmount) {
    //         resourceCost.push({ resourceId: resource, amount: costAmount.value });
    //     }
    // }

    let laborConfig = useComponentValue(LaborConfig, Utils.getEntityIdFromKeys([BigInt(LABOR_CONFIG_ID)]))

    const isFood = useMemo(() => [254, 255].includes(resourceId), [resourceId]);
    const resource = useMemo(() => findResourceById(resourceId), [resourceId]);

    // TODO: make sure you have enough resources before allowing to click
    const handleBuild = () => {
        build_labor({realm_id: realmEntityId, 
                    resource_type: resourceId, 
                    labor_units: isFood? 12: laborAmount, 
                    multiplier: multiplier})
        onClose();
    }

    useEffect(() => { }, []);

    return (
        <SecondaryPopup>
            <SecondaryPopup.Head>
                <div className='flex items-center space-x-1'>
                    <div className='mr-0.5'>Build Labor:</div>
                </div>
            </SecondaryPopup.Head>
            <SecondaryPopup.Body width={'376px'}>
                <div className='flex flex-col items-center p-2'>
                    <Headline>Produce More {resource?.trait}</Headline>
                    <div className='relative flex justify-between w-full mt-2 text-xxs text-lightest'>
                        <div className='flex items-center'>
                            {
                                !isFood && <><ResourceIcon className='mr-1' resource={resource?.trait || ''} size='xs' /> {resource?.trait}</>
                            }
                            {
                                resourceId === 254 && <div className='flex items-center'><Farms className='mr-1' /><span className='mr-1 font-bold'>{`${multiplier}/${realm?.rivers || 0}`}</span> Farms</div>
                            }
                            {
                                resourceId === 255 && <div className='flex items-center'>
                                    {/* // DISCUSS: can only be 0, because that is when you can build */}
                                    <FishingVillages className='mr-1' /><span className='mr-1 font-bold'>{`${multiplier}/${realm?.harbors || 0}`}</span> Fishing Villages
                                </div>
                            }
                        </div>
                        {/* // TODO: could be total harvest after 24 hours */}
                        {/* <div className='absolute flex flex-col items-center -translate-x-1/2 -translate-y-1 left-1/2'>
                            <div className='flex'>
                                <div className='mx-1 text-brilliance'>+99.23</div>
                                <ResourceIcon resource={findResourceById(resourceId)?.trait as any} size='xs' className='!w-[12px]' />
                            </div>
                            <div className='italic text-light-pink'>Harvested</div>
                        </div> */}
                        {laborConfig && <div className='flex items-center'>
                            {`+${isFood? (laborConfig.base_food_per_cycle * multiplier / 2) : ''}${isFood? '' : laborConfig.base_resources_per_cycle / 2}`}
                            <ResourceIcon containerClassName='mx-0.5' className='!w-[12px]' resource={findResourceById(resourceId)?.trait as any} size='xs' />
                            /h
                        </div>}
                    </div>
                    {isFood && <BuildingsCount count={multiplier} maxCount={resourceId === 254? realm?.rivers || 0 : realm?.harbors || 0} className='mt-2' />}
                    <div className={clsx('relative w-full', isFood ? 'mt-2' : 'mt-3')}>
                        {resourceId === 254 && <img src={`/images/buildings/farm.png`} className='object-cover w-full h-full rounded-[10px]' />}
                        {resourceId === 255 && <img src={`/images/buildings/fishing_village.png`} className='object-cover w-full h-full rounded-[10px]' />}
                        {!isFood && <img src={`/images/resources/${resourceId}.jpg`} className='object-cover w-full h-full rounded-[10px]' />}
                        <div className='fle flex-col p-2 absolute left-2 bottom-2 rounded-[10px] bg-black/60'>
                            <div className="mb-1 ml-1 italic text-light-pink text-xxs">Price:</div>
                            <div className='grid grid-cols-4 gap-2'>
                            {resourceCost.map(({ resourceId, amount }) => (
                                <ResourceCost type='vertical' resourceId={resourceId} amount={amount} />
                            ))}
                            </div>
                        </div>

                    </div>
                </div>
                <div className='flex justify-between m-2 text-xxs'>
                    {
                        !isFood && <div className='flex items-center'><div className='italic text-light-pink'>Amount</div>
                            <NumberInput className='ml-2 mr-2' value={laborAmount} step={5} onChange={setLaborAmount} max={9999}/>
                            <div className='italic text-gold'>{formatTimeLeft(laborAmount * (laborConfig?.base_labor_units || 0))}</div>
                        </div>
                    }
                    {
                        isFood && <div className='flex items-center'><div className='italic text-light-pink'>Amount</div>
                            <NumberInput className='ml-2 mr-2' value={multiplier} onChange={setMultiplier} max={resourceId === 254? realm?.rivers || 0 : realm?.harbors || 0}/>
                            <div className='italic text-gold'>Max {resourceId === 254? realm?.rivers || 0 : realm?.harbors || 0}</div>
                        </div>
                    }
                    <Button className='!px-[6px] !py-[2px] text-xxs' 
                            onClick={() => handleBuild()} 
                            variant='outline'>{isFood? `Build`: `Buy Tools`}
                    </Button>
                </div>
            </SecondaryPopup.Body>
        </SecondaryPopup>
    );
};

// TODO: move to utils
const formatTimeLeft = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const secondsLeft = seconds % 86400;
    const hours = Math.floor(secondsLeft / 3600);

    return `${days} days ${hours}h`;
};