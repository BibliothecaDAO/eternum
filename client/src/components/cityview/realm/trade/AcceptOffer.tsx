import { useState } from 'react';
import { SecondaryPopup } from '../../../../elements/SecondaryPopup';
import Button from '../../../../elements/Button';
import { Steps } from '../../../../elements/Steps';
import { SelectCaravanPanel } from './CreateOffer';

type AcceptOfferPopupProps = {
    onClose: () => void;
    onAccept: () => void;
    selectedResourceIdsGive: number[];
    selectedResourceIdsGet: number[];
    selectedResourcesGiveAmounts: { [key: number]: number };
    selectedResourcesGetAmounts: { [key: number]: number };
    resourceWeight: number;
}

export const AcceptOfferPopup = ({ onClose, onAccept, selectedResourceIdsGet, selectedResourceIdsGive, selectedResourcesGetAmounts, selectedResourcesGiveAmounts, resourceWeight }: AcceptOfferPopupProps) => {
    const [selectedCaravan, setSelectedCaravan] = useState<number>(0);
    const [isNewCaravan, setIsNewCaravan] = useState(false);
    const [donkeysCount, setDonkeysCount] = useState(0);

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
                        selectedResourceIdsGet={selectedResourceIdsGet}
                        selectedResourcesGetAmounts={selectedResourcesGetAmounts}
                        selectedResourceIdsGive={selectedResourceIdsGive}
                        selectedResourcesGiveAmounts={selectedResourcesGiveAmounts}
                        resourceWeight={resourceWeight}
                    />
                </div>
                <div className='flex justify-between m-2 text-xxs'>
                    <Button className='!px-[6px] !py-[2px] text-xxs' onClick={onClose} variant='outline'>Cancel</Button>
                    <Button className='!px-[6px] !py-[2px] text-xxs' onClick={onAccept} variant='success'>Accept Offer</Button>
                </div>
            </SecondaryPopup.Body>
        </SecondaryPopup >
    );
};