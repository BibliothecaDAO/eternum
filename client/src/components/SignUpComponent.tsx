import { SecondaryPopup } from "../elements/SecondaryPopup";
import { Headline } from "../elements/Headline";
import Button from "../elements/Button";
import { useEffect, useState } from "react";
import useUIStore from "../hooks/store/useUIStore";
import { useDojo } from "../DojoContext";
import { displayAddress } from "../utils/utils";
import clsx from "clsx";

type SignUpComponentProps = {};

export const SignUpComponent = ({}: SignUpComponentProps) => {
  const [canCreate, setCanCreate] = useState(true);

  const {
    account: { create, isDeploying, list, select },
  } = useDojo();

  const onReset = () => {
    localStorage.removeItem("burners");
    setCanCreate(true);
  };

  useEffect(() => {
    if (list().length > 0) {
      setCanCreate(false);
    }
  }, []);

  const onCreate = () => {
    create();
    setCanCreate(false);
  };

  const [showSignupPopup, setShowSignupPopup] = useState(true);
  const setShowBlurOverlay = useUIStore((state) => state.setShowBlurOverlay);
  const toggleSound = useUIStore((state) => state.toggleSound);
  useEffect(() => {
    setShowBlurOverlay(showSignupPopup);
    if (!showSignupPopup) {
      toggleSound();
    }
  }, [showSignupPopup]);

  return (
    <SecondaryPopup className="!translate-x-0 !left-auto">
      <SecondaryPopup.Head>
        <div className="mr-0.5">Sign Up</div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width="400px">
        <div className="flex flex-col items-center p-3">
          <img src="/images/eternum-logo.svg" className=" w-48" alt="Eternum Logo" />
          <img src="/images/buildings/storehouse.jpg" className="w-full my-3" alt="Eternum Logo" />
          <div className={clsx("flex mx-2", !canCreate && "mb-2")}>
            {/* className={clsx("ml-auto p-2 !h-4 text-xxs !rounded-md", !canAccept && "mb-4")} */}
            <Button disabled={!canCreate} variant={"primary"} onClick={onCreate}>
              {isDeploying ? "deploying burner" : "create burner"}
            </Button>
            <Button variant={"danger"} onClick={onReset}>
              {"reset burners"}
            </Button>
          </div>
          {!canCreate && (
            <div className="text-xxs text-order-giants/70 w-min whitespace-nowrap">Can deploy maximum 1 burner</div>
          )}
          <div className="border border-gold my-3 w-full rounded-lg bg-black  flex p-2 text-white">
            <div className="px-2">signer: </div>

            <select className={"w-full bg-black"} onChange={(e) => select(e.target.value)}>
              {list().map((account, index) => {
                return (
                  <option value={account.address} key={index}>
                    {displayAddress(account.address)}
                  </option>
                );
              })}
            </select>
          </div>
          <Headline size="big">Sign Up</Headline>
          <div className="flex flex-col w-full text-center text-xs text-white">
            <div className=" border border-gold my-3 w-full rounded-lg bg-black p-2 flex justify-between">
              <img src="/images/argent-x.svg" className="h-8" alt="Argent X Logo" />
              <Button className=" !rounded text-brown" variant="primary" onClick={() => setShowSignupPopup(false)}>
                Log in with Argent X
              </Button>
            </div>
            Or
            <div className=" border border-gold my-3 w-full rounded-lg bg-black p-2 flex justify-between">
              <img src="/images/braavos.svg" className="h-8" alt="Braavos Logo" />
              <Button className=" !rounded text-brown" variant="primary" onClick={() => setShowSignupPopup(false)}>
                Log in with Braavos
              </Button>
            </div>
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
