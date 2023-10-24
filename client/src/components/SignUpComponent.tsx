import { SecondaryPopup } from "../elements/SecondaryPopup";
import { Headline } from "../elements/Headline";
import Button from "../elements/Button";
import { useEffect, useMemo, useState } from "react";
import useUIStore from "../hooks/store/useUIStore";
import { useDojo } from "../DojoContext";
import { displayAddress } from "../utils/utils";
import ListSelect from "../elements/ListSelect";
import { ReactComponent as Danger } from "../assets/icons/common/danger.svg";

type SignUpComponentProps = {
  worldLoading: boolean;
  worldProgress: number;
};

export const SignUpComponent = ({ worldLoading, worldProgress }: SignUpComponentProps) => {
  const {
    account: { create, isDeploying, list, account, select, clear },
  } = useDojo();

  const [showSignupPopup, setShowSignupPopup] = useState(true);
  const setShowBlurOverlay = useUIStore((state) => state.setShowBlurOverlay);
  const toggleSound = useUIStore((state) => state.toggleSound);

  const isWalletSelected = useMemo(() => account.address !== import.meta.env.VITE_KATANA_ACCOUNT_1_ADDRESS!, [account]);

  useEffect(() => {
    setShowBlurOverlay(showSignupPopup);
    if (!showSignupPopup) {
      toggleSound();
    }
  }, [showSignupPopup]);

  return (
    <SecondaryPopup className="!translate-x-0 !left-auto !top-1/2 !-translate-y-1/2">
      <SecondaryPopup.Head className="!cursor-default">
        <div className="mr-0.5">Sign Up</div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width="400px">
        <div className="flex flex-col items-center p-3">
          <img src="/images/eternum-logo.svg" className=" w-48" alt="Eternum Logo" />
          <img src="/images/buildings/storehouse.jpg" className="w-full my-3" alt="Eternum Logo" />
          <Headline size="big">Testnet Sign Up</Headline>
          <div className="flex my-2 items-center space-x-2">
            <Button variant={"success"} onClick={create} disabled={isDeploying} isLoading={isDeploying}>
              {isDeploying ? "" : "Create a new wallet"}
            </Button>
            <div className="text-white text-xs"> Or </div>
            <Button
              variant={"danger"}
              onClick={() => {
                if (window.confirm("Are you sure want to delete all wallets?")) {
                  clear();
                }
              }}
            >
              {"Delete all wallets"}
            </Button>
          </div>
          <ListSelect
            title="Active Wallet: "
            options={list().map((account) => ({
              id: account.address,
              label: displayAddress(account.address),
            }))}
            value={account.address}
            onChange={select}
          />
          <Button
            // cannot use master account to sign in
            disabled={!isWalletSelected || worldLoading}
            className="mt-2 !p-2"
            variant={worldLoading || isWalletSelected ? "primary" : "outline"}
            onClick={() => setShowSignupPopup(false)}
          >
            {worldLoading ? "World Loading" : isWalletSelected ? "Start playing" : "No wallet selected"}
          </Button>
          {/* Progress text */}
          {worldLoading && (
            <div className="mt-2 text-center text-xs text-white">Loading: {worldProgress.toFixed(2)}%</div>
          )}
          <div className="flex items-center mt-2 mb-1 text-xs text-center text-white">
            <Danger />
            <div className="ml-1 text-danger">Create new wallet if you played before October 14th</div>
          </div>
          {/* <Headline size="big">Sign Up</Headline>
          <div className="flex flex-col w-full text-center text-xs text-white">
            <div className=" border border-gold my-3 w-full rounded-lg bg-black p-2 flex justify-between">
              <img src="/images/argent-x.svg" className="h-8" alt="Argent X Logo" />
              <Button
                // cannot use master account to sign in
                disabled={account.address === import.meta.env.VITE_KATANA_ACCOUNT_1_ADDRESS!}
                className=" !rounded text-brown"
                variant="primary"
                onClick={() => setShowSignupPopup(false)}
              >
                Log in with Argent X
              </Button>
            </div>
            Or
            <div className=" border border-gold my-3 w-full rounded-lg bg-black p-2 flex justify-between">
              <img src="/images/braavos.svg" className="h-8" alt="Braavos Logo" />
              <Button
                disabled={account.address === import.meta.env.VITE_KATANA_ACCOUNT_1_ADDRESS!}
                className=" !rounded text-brown"
                variant="primary"
                onClick={() => setShowSignupPopup(false)}
              >
                Log in with Braavos
              </Button>
            </div>
          </div> */}
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
