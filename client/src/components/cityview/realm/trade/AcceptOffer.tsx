import { useEffect, useState } from 'react';
import { SecondaryPopup } from '../../../../elements/SecondaryPopup';
import Button from '../../../../elements/Button';
import { Steps } from '../../../../elements/Steps';
import { SelectCaravanPanel } from './CreateOffer';
import { useDojo } from '../../../../DojoContext';
import useRealmStore from '../../../../hooks/store/useRealmStore';
import { useComponentValue } from '@dojoengine/react';
import { getComponentValue } from '@latticexyz/recs';
import { Utils } from '@dojoengine/core';
import { Realm, ResourcesOffer } from '../../../../types';

type AcceptOfferPopupProps = {
    onClose: () => void;
    selectedTradeId: number;
}

export const AcceptOfferPopup = ({ onClose, selectedTradeId }: AcceptOfferPopupProps) => {
    const [selectedCaravan, setSelectedCaravan] = useState<number>(0);
    const [isNewCaravan, setIsNewCaravan] = useState(false);
    const [donkeysCount, setDonkeysCount] = useState(0);

    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsLoading(false);
    }, [selectedTradeId])

    const {
        systemCalls: { attach_caravan, take_fungible_order, create_free_transport_unit, create_caravan, change_order_status },
        components: { Trade, Status, FungibleEntities, Resource, Realm },
    } = useDojo();

    const { realmEntityId } = useRealmStore();

    let trade = getComponentValue(Trade, Utils.getEntityIdFromKeys([BigInt(selectedTradeId)]));

    const acceptOffer = async () => {
        if (isNewCaravan) {
            setIsLoading(true);
            const transport_units_id = await create_free_transport_unit({ realm_id: realmEntityId, quantity: donkeysCount });
            const caravan_id = await create_caravan({ entity_ids: [transport_units_id] });
            await attach_caravan({ realm_id: realmEntityId, trade_id: selectedTradeId, caravan_id })
            await take_fungible_order({
                taker_id: realmEntityId,
                trade_id: selectedTradeId
            })
        } else {
            setIsLoading(true);
            await attach_caravan({ realm_id: realmEntityId, trade_id: selectedTradeId, caravan_id: selectedCaravan });
            await take_fungible_order({
                taker_id: realmEntityId,
                trade_id: selectedTradeId
            })
        }
        onClose();
    }

    // set maker order
    let makerRealm: Realm | undefined;
    if (trade) {
        makerRealm = getComponentValue(Realm, Utils.getEntityIdFromKeys([BigInt(trade.maker_id)]));
    }

    const resourcesGet = trade && getResources(trade.maker_order_id);
    const resourcesGive = trade && getResources(trade.taker_order_id);

    function getResources(orderId: number): ResourcesOffer[] {
        const resources: ResourcesOffer[] = [];
        const fungibleEntities = getComponentValue(FungibleEntities, Utils.getEntityIdFromKeys([BigInt(orderId)]));
        if (fungibleEntities) {
            for (let i = 0; i < fungibleEntities.count; i++) {
                const resource = getComponentValue(
                    Resource,
                    Utils.getEntityIdFromKeys([BigInt(orderId), BigInt(fungibleEntities.key), BigInt(i)])
                );
                if (resource) {
                    resources.push({ amount: resource.balance, resourceId: resource.resource_type });
                }
            }
        }
        return resources;
    }

    let resourceWeight = 0;
    for (const [resourceId, amount] of Object.entries(resourcesGive?.map(resource => resource.amount) || {})) {
        resourceWeight += amount * 1;
    }

    return (
        <SecondaryPopup>
            <SecondaryPopup.Head>
                <div className='flex items-center space-x-1'>
                    <div className='mr-0.5'>Accept Offer:</div>
                </div>
            </SecondaryPopup.Head>
            <SecondaryPopup.Body>
                <div className='flex flex-col items-center pt-2'>
                    <SelectCaravanPanel
                        donkeysCount={donkeysCount}
                        setDonkeysCount={setDonkeysCount}
                        isNewCaravan={isNewCaravan}
                        setIsNewCaravan={setIsNewCaravan}
                        selectedCaravan={selectedCaravan}
                        setSelectedCaravan={setSelectedCaravan}
                        selectedResourceIdsGet={resourcesGet?.map(resource => resource.resourceId) || []}
                        selectedResourcesGetAmounts={resourcesGet?.map(resource => resource.amount) || []}
                        selectedResourceIdsGive={resourcesGive?.map(resource => resource.resourceId) || []}
                        selectedResourcesGiveAmounts={resourcesGive?.map(resource => resource.amount) || []}
                        resourceWeight={resourceWeight}
                    />
                </div>
                <div className='flex justify-between m-2 text-xxs'>
                    <Button className='!px-[6px] !py-[2px] text-xxs' onClick={onClose} variant='outline'>Cancel</Button>
                    <div>
                        {!isLoading && <Button className='!px-[6px] !py-[2px] text-xxs' onClick={acceptOffer} variant='success'>Accept Offer</Button>}
                        {isLoading && <Button isLoading={true} onClick={() => {}} variant="danger" className="ml-auto p-2 !h-4 text-xxs !rounded-md"> {} </Button>}
                    </div>
                </div>
            </SecondaryPopup.Body>
        </SecondaryPopup >
    );
};