import React, { useEffect, useState } from 'react';
import { FilterButton } from '../../elements/FilterButton';
import { FilterPopup } from '../../elements/FilterPopup';
import { resources } from '../../constants/resources';
import { SelectBox } from '../../elements/SelectBox';
import { ResourceIcon } from '../../elements/ResourceIcon';
import { ReactComponent as CloseIcon } from '../../assets/icons/common/cross.svg';
import { ReactComponent as CaretDownFill } from '../../assets/icons/common/caret-down-fill.svg';
import Button from '../../elements/Button';
import { OrderIcon } from '../../elements/OrderIcon';
import { ResourceCost } from '../../elements/ResourceCost';

type CaravanDetailsProps = {
    caravanId: number;
    onClose: () => void;
}

export const CaravanDetails = ({ caravanId, onClose }: CaravanDetailsProps) => {

    return (
        <FilterPopup>
            <FilterPopup.Head>
                <div className='flex items-center space-x-1'>
                    <div className='mr-0.5'>Caravan #4 9’999’403 / 10’000’000</div>
                    <CloseIcon className="w-3 h-3 cursor-pointer fill-white" />
                </div>
            </FilterPopup.Head>
            <FilterPopup.Body>
                <div className='flex items-center mt-2 ml-2 text-xxs'>
                    <span className='italic text-light-pink'>
                        Traveling to
                    </span>
                    <div className='flex items-center ml-1 mr-1 text-gold'>
                        <OrderIcon order='brilliance' className='mr-1' size='xs' />
                        Lordlacrima
                    </div>
                    <span className='italic text-light-pink'>
                        with
                    </span>
                </div>
                <div className='grid grid-cols-3 gap-2 px-2 py-1 mt-1'>
                    <ResourceCost resourceId={1} amount={100} />
                    <ResourceCost resourceId={2} amount={100} />
                    <ResourceCost resourceId={3} amount={100} />
                    <ResourceCost resourceId={4} amount={100} />
                </div>
                <div className='flex items-center mt-3 ml-2 text-xxs'>
                    <span className='italic text-light-pink'>
                        You will get
                    </span>
                </div>
                <div className='grid grid-cols-3 gap-2 px-2 py-1'>
                    <ResourceCost resourceId={15} amount={100} color='text-brilliance' />
                    <ResourceCost resourceId={19} amount={100} color='text-brilliance' />
                </div>
                <div className='flex justify-start m-2'>
                    <Button onClick={onClose} variant='primary'>Close</Button>
                </div>
            </FilterPopup.Body>
        </FilterPopup >
    );
};