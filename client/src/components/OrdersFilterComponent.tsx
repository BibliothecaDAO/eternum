import React, { useEffect, useState } from 'react';
import { FilterButton } from '../elements/FilterButton';
import { FilterPopup } from '../elements/FilterPopup';
import { orders } from '../constants/orders';
import { SelectBox } from '../elements/SelectBox';
import { ResourceIcon } from '../elements/ResourceIcon';
import { ReactComponent as CloseIcon } from '../assets/icons/common/cross.svg';
import Button from '../elements/Button';
import { OrderIcon } from '../elements/OrderIcon';
import clsx from 'clsx';

type OrdersFilterProps = {}

export const OrdersFilter = ({ }: OrdersFilterProps) => {
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [popupOpened, setPopupOpened] = useState<boolean>(false);

    const selectOrder = (resource: string) => {
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
                        {selectedOrders.map((order, index) => (
                            <OrderIcon order={order} size='xs' />
                        ))}
                        <CloseIcon className="w-3 h-3 cursor-pointer fill-white" onClick={() => setSelectedOrders([])} />
                    </div>
                </FilterPopup.Head>
                <FilterPopup.Body width={'284px'}>
                    <div className='grid grid-cols-4 gap-2 p-2'>
                        {orders.map((order, index) => (
                            <div className={clsx('flex cursor-pointer flex-col items-center py-2 hover:bg-dark rounded-xl text-gold text-xxs',
                                selectedOrders.includes(order.orderName) && `bg-order-${order.orderName.toLowerCase()} !text-white`
                            )} onClick={() => selectOrder(order.orderName)}>
                                <OrderIcon color={selectedOrders.includes(order.orderName) ? 'white' : undefined} order={order.orderName} size='xs' className='mb-2' />
                                <div>
                                    {order.orderName}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className='flex justify-start mx-2 mb-2'>
                        <Button onClick={() => setPopupOpened(false)} variant='primary'>Close</Button>
                    </div>
                </FilterPopup.Body>
            </FilterPopup>}
        </>
    );
};