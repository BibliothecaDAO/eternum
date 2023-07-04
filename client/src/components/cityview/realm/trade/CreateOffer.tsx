import React, { useEffect, useState } from 'react';
import { SecondaryPopup } from '../../../../elements/SecondaryPopup';
import Button from '../../../../elements/Button';
import { Headline } from '../../../../elements/Headline';
import { ResourceCost } from '../../../../elements/ResourceCost';
import { NumberInput } from '../../../../elements/NumberInput';
import { SelectableResource } from '../../../../elements/SelectableResource';
import { resources } from '../../../../constants/resources';

type CreateOfferPopupProps = {
    onClose: () => void;
    onCreate: () => void;
}

export const CreateOfferPopup = ({ onClose, onCreate }: CreateOfferPopupProps) => {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedResourceIdsGive, setSelectedResourceIdsGive] = useState<number[]>([]);
    const [selectedResourceIdsGet, setSelectedResourceIdsGet] = useState<number[]>([]);
    const [selectedResourcesGiveAmounts, setSelectedResourcesGiveAmounts] = useState<{ [key: number]: number }>({});
    const [selectedResourcesGetAmounts, setSelectedResourcesGetAmounts] = useState<{ [key: number]: number }>({});
    const [selectedCaravan, setSelectedCaravan] = useState<number>(0);

    useEffect(() => { }, []);

    return (
        <SecondaryPopup>
            <SecondaryPopup.Head>
                <div className='flex items-center space-x-1'>
                    <div className='mr-0.5'>Create Offer:</div>
                </div>
            </SecondaryPopup.Head>
            <SecondaryPopup.Body>
                <div className='flex flex-col items-center pt-2'>
                    <SelectResourcesPanel
                        selectedResourceIdsGive={selectedResourceIdsGive}
                        setSelectedResourceIdsGive={setSelectedResourceIdsGive}
                        selectedResourceIdsGet={selectedResourceIdsGet}
                        setSelectedResourceIdsGet={setSelectedResourceIdsGet}
                    />
                </div>
                <div className='flex justify-between m-2 text-xxs'>
                    <Button className='!px-[6px] !py-[2px] text-xxs' onClick={onClose} variant='primary'>Close</Button>
                    <Button className='!px-[6px] !py-[2px] text-xxs' onClick={onCreate} variant='success'>Create</Button>
                </div>
            </SecondaryPopup.Body>
        </SecondaryPopup>
    );
};

const SelectResourcesPanel = ({ selectedResourceIdsGive, setSelectedResourceIdsGive, selectedResourceIdsGet, setSelectedResourceIdsGet }: {
    selectedResourceIdsGive: number[];
    setSelectedResourceIdsGive: (selectedResourceIds: number[]) => void;
    selectedResourceIdsGet: number[];
    setSelectedResourceIdsGet: (selectedResourceIds: number[]) => void;
}) => {
    return <div className="grid grid-cols-9 gap-2 p-2">
        <div className='flex flex-col items-center col-span-4'>
            <Headline className='mb-2'>You Give</Headline>
            <div className='grid grid-cols-4 gap-2'>
                {resources.map(({ id, trait: name }) => (
                    <SelectableResource
                        key={id}
                        resourceId={id}
                        amount={100}
                        disabled={100 < 0 /*check amount*/}
                        selected={selectedResourceIdsGive.includes(id)}
                        onClick={() => {
                            if (selectedResourceIdsGive.includes(id)) {
                                setSelectedResourceIdsGive(selectedResourceIdsGive.filter((_id) => _id !== id));
                            } else {
                                setSelectedResourceIdsGive([...selectedResourceIdsGive, id]);
                            }
                        }}
                    />
                ))}
            </div>
        </div>
        <div className='flex items-center justify-center'>
            <svg width="12" height="256" viewBox="0 0 12 256" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 110L9.83871 127.5L2 145" stroke="#E0AF65" />
            </svg>
        </div>
        <div className='flex flex-col items-center col-span-4'>
            <Headline className='mb-2'>You Get</Headline>
            <div className='grid grid-cols-4 gap-2'>
                {resources.map(({ id, trait: name }) => (
                    <SelectableResource
                        key={id}
                        resourceId={id}
                        amount={100}
                        selected={selectedResourceIdsGet.includes(id)}
                        disabled={selectedResourceIdsGive.includes(id)}
                        onClick={() => {
                            if (selectedResourceIdsGet.includes(id)) {
                                setSelectedResourceIdsGet(selectedResourceIdsGet.filter((_id) => _id !== id));
                            } else {
                                setSelectedResourceIdsGet([...selectedResourceIdsGet, id]);
                            }
                        }}
                    />
                ))}
            </div>
        </div>
    </div>
}