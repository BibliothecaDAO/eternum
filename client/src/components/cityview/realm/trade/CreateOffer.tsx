import React, { useEffect, useState } from 'react';
import { SecondaryPopup } from '../../../../elements/SecondaryPopup';
import Button from '../../../../elements/Button';
import { Headline } from '../../../../elements/Headline';
import { ResourceCost } from '../../../../elements/ResourceCost';
import { NumberInput } from '../../../../elements/NumberInput';
import { SelectableResource } from '../../../../elements/SelectableResource';

type CreateOfferPopupProps = {
    onClose: () => void;
    onCreate: () => void;
}

export const CreateOfferPopup = ({ onClose, onCreate }: CreateOfferPopupProps) => {
    const [step, setStep] = useState(1);

    useEffect(() => { }, []);

    return (
        <SecondaryPopup>
            <SecondaryPopup.Head>
                <div className='flex items-center space-x-1'>
                    <div className='mr-0.5'>Create Offer:</div>
                </div>
            </SecondaryPopup.Head>
            <SecondaryPopup.Body>
                <div className='flex flex-col items-center p-2'>
                    <SelectableResource resourceId={1} amount={100} />
                </div>
                <div className='flex justify-between m-2 text-xxs'>
                    <Button className='!px-[6px] !py-[2px] text-xxs' onClick={onClose} variant='primary'>Close</Button>
                    <Button className='!px-[6px] !py-[2px] text-xxs' onClick={onCreate} variant='success'>Create</Button>
                </div>
            </SecondaryPopup.Body>
        </SecondaryPopup>
    );
};