import React, { useEffect, useState } from 'react';
import { FilterButton } from '../elements/FilterButton';
import { FilterPopup } from '../elements/FilterPopup';
import { orders } from '../constants/orders';
import { SelectBox } from '../elements/SelectBox';
import { ResourceIcon } from '../elements/ResourceIcon';
import { ReactComponent as CloseIcon } from '../assets/icons/common/cross.svg';
import Button from '../elements/Button';
import { OrderIcon } from '../elements/OrderIcon';

type OrdersFilterProps = {}

export const OrdersFilter = ({ }: OrdersFilterProps) => {
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [popupOpened, setPopupOpened] = useState<boolean>(false);

    const selectResource = (resource: string) => {
        if (selectedOrders.includes(resource)) {
            setSelectedOrders(selectedOrders.filter((r) => r !== resource));
        } else {
            setSelectedOrders([...selectedOrders, resource]);
        }
    };

    return (
        <>
            <FilterButton active={popupOpened} onClick={() => setPopupOpened(!popupOpened)}>
                Orders
            </FilterButton>
            {popupOpened && <FilterPopup>
                <FilterPopup.Head>
                    <div className='flex items-center space-x-1'>
                        <div className='mr-0.5'>Orders:</div>
                        {selectedOrders.map((resource, index) => (
                            <ResourceIcon size='xs' resource={resource} />

                        ))}
                        <CloseIcon className="w-3 h-3 cursor-pointer fill-white" onClick={() => setSelectedOrders([])} />
                    </div>
                </FilterPopup.Head>
                <FilterPopup.Body>
                    <div className='grid grid-cols-4 gap-1 p-1'>
                        {orders.map((order, index) => (
                            <div className='flex flex-col rounded-xl'>
                                <OrderIcon order={order.orderName} size='xs' />
                                <div>
                                    {order.orderName}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className='flex justify-end mb-2 mr-2'>
                        <Button onClick={() => setPopupOpened(false)} variant='primary'>Close</Button>
                    </div>
                </FilterPopup.Body>
            </FilterPopup>}
        </>
    );
};