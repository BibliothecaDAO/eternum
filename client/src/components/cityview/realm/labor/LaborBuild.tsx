import React, { useEffect, useState } from 'react';
import { SecondaryPopup } from '../../../../elements/SecondaryPopup';
import Button from '../../../../elements/Button';
import { Headline } from '../../../../elements/Headline';
import { ResourceCost } from '../../../../elements/ResourceCost';
import { NumberInput } from '../../../../elements/NumberInput';

type LaborBuildPopupProps = {
    resourceId: number;
    onClose: () => void;
    onBuild: () => void;
}

export const LaborBuildPopup = ({ resourceId, onClose, onBuild }: LaborBuildPopupProps) => {
    const [state, setState] = useState();
    const [laborAmount, setLaborAmount] = useState(1);
    const [multiplier, setMultiplier] = useState(1);


    useEffect(() => { }, []);

    return (
        <SecondaryPopup>
            <SecondaryPopup.Head>
                <div className='flex items-center space-x-1'>
                    <div className='mr-0.5'>Build Labor:</div>
                </div>
            </SecondaryPopup.Head>
            <SecondaryPopup.Body>
                <div className='flex flex-col items-center p-2'>
                    <Headline>Required Resources</Headline>
                    <div className='grid grid-cols-4 gap-2 mt-2'>
                        <ResourceCost resourceId={1} amount={100} />
                        <ResourceCost resourceId={2} amount={100} />
                        <ResourceCost resourceId={3} amount={100} />
                        <ResourceCost resourceId={4} amount={100} />
                    </div>
                    <div className='flex flex-col items-center mt-2'>
                        <Headline>Labor Amount</Headline>
                        <NumberInput className='mt-2' value={laborAmount} step={5} onChange={setLaborAmount} />
                    </div>
                    <div className='flex flex-col items-center mt-2'>
                        <Headline>Farms Count</Headline>
                        <NumberInput className='mt-2' value={multiplier} onChange={setMultiplier} />
                    </div>
                </div>
                <div className='flex justify-between m-2 text-xxs'>
                    <Button className='!px-[6px] !py-[2px] text-xxs' onClick={onClose} variant='primary'>Close</Button>
                    <Button className='!px-[6px] !py-[2px] text-xxs' onClick={onBuild} variant='success'>Build</Button>
                </div>
            </SecondaryPopup.Body>
        </SecondaryPopup>
    );
};