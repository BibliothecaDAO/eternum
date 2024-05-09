import { useEffect, useMemo, useState } from "react";
import Button from "@/ui/elements/Button";
import useUIStore from "@/hooks/store/useUIStore";
import SettleRealmComponent from "@/ui/components/cityview/realm/SettleRealmComponent";
import { useAddressStore } from "@/hooks/store/useAddressStore";
import { useDojo } from "@/hooks/context/DojoContext";
import TextInput from "@/ui/elements/TextInput";
import ListSelect from "@/ui/elements/ListSelect";
import { displayAddress } from "@/ui/utils/utils";
import { ReactComponent as Copy } from "@/assets/icons/common/copy.svg";
import { ReactComponent as Import } from "@/assets/icons/common/import.svg";
import { ReactComponent as Cross } from "@/assets/icons/common/cross.svg";
import { ReactComponent as ArrowRight } from "@/assets/icons/common/arrow-right.svg";
import { useRealm } from "@/hooks/helpers/useRealm";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useTour } from "@reactour/tour";

export const StepContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      className="flex justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, y: 20 }}
      exit={{ opacity: 0 }}
      transition={{ type: "ease-in-out", stiffness: 3, duration: 0.2 }}
    >
      <div className="self-center bg-brown/80 p-8 text-gold sharp-corners min-w-[800px] max-w-[800px] rounded border-2 border-gold backdrop-blur-lg border-gradient overflow-hidden  clip-squared">
        {children}
      </div>
    </motion.div>
  );
};

export const StepOne = ({ onNext }: { onNext: () => void }) => {
  return (
    <StepContainer>
      <div className="w-full text-center pt-6">
        <div className="mx-auto flex mb-8">
          <img src="/images/eternum-logo.svg" className="w-48 mx-auto" alt="Eternum Logo" />
        </div>
        <h2 className="">A world awaits you...</h2>
      </div>
      <div className="flex space-x-2 mt-8 justify-center">
        <Button size="md" className="mx-auto" variant="primary" onClick={onNext}>
          Choose your Leader
          <ArrowRight className="w-2 ml-2 fill-current" />
        </Button>
      </div>
    </StepContainer>
  );
};

export const Naming = ({ onNext }: { onNext: () => void }) => {
  const {
    account: { create, isDeploying, list, account, select, clear },
    setup: {
      systemCalls: { set_address_name },
    },
  } = useDojo();

  const setTooltip = useUIStore((state) => state.setTooltip);

  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [inputName, setInputName] = useState("");

  const { loading, setLoading, addressName, setAddressName } = useAddressStore();

  const { getAddressName } = useRealm();

  const name = getAddressName(account.address);
  const { playerRealms } = useEntities();

  // @dev: refactor this
  useEffect(() => {
    setAddressName(name);
  }, [name]);

  const onSetName = async () => {
    setLoading(true);
    if (inputName) {
      await set_address_name({ name: inputName, signer: account as any });
      setAddressName(inputName);
      setLoading(false);
    }
  };

  const onCopy = () => {
    const burners = localStorage.getItem("burners");
    if (burners) {
      const burner = JSON.parse(burners)[account.address];
      navigator.clipboard.writeText(
        JSON.stringify({
          address: account.address,
          privateKey: burner.privateKey,
          publicKey: burner.publicKey,
          active: burner.active,
          deployTx: burner.deployTx,
        }),
      );
      setCopyMessage("Account exported!");
    } else {
      setCopyMessage("No account to export");
    }
  };

  const onImportAccount = () => {
    navigator.clipboard.readText().then((text) => {
      try {
        const burner = JSON.parse(text);
        let currentBurners = localStorage.getItem("burners") ? JSON.parse(localStorage.getItem("burners") || "") : {};

        if (currentBurners.hasOwnProperty(burner.address)) {
          throw new Error("Account already imported");
        }

        // Add the new burner account
        currentBurners[burner.address] = {
          privateKey: burner.privateKey,
          publicKey: burner.publicKey,
          active: burner.active,
          deployTx: burner.deployTx,
        };

        // Save the updated burners object back to localStorage
        localStorage.setItem("burners", JSON.stringify(currentBurners));
        setImportMessage("Account imported successfully!");
      } catch (e) {
        console.error(e);
        setImportMessage("Invalid account");
      }
    });
  };

  const isWalletSelected = useMemo(() => account.address !== import.meta.env.VITE_PUBLIC_MASTER_ADDRESS!, [account]);

  useEffect(() => {
    if (list().length == 0) {
      create();
    }
  }, [isWalletSelected]);

  useEffect(() => {
    if (copyMessage || importMessage) {
      setTooltip({
        position: "top",
        content: (
          <>
            <p className="whitespace-nowrap">{copyMessage ? copyMessage : importMessage}</p>
          </>
        ),
      });
    }
  }, [copyMessage, importMessage]);

  return (
    <StepContainer>
      <div className="flex flex-col items-center p-3 ">
        <h3>Select Account</h3>
        <div className="flex space-x-6 pt-4 w-full justify-center uppercase">
          <div>
            <div className=" border-gold border p-2 w-full">
              {loading ? (
                <span>Loading...</span>
              ) : addressName ? (
                <span>{addressName}</span>
              ) : (
                <div className="flex w-full h-full">
                  <TextInput placeholder="Your Name..." maxLength={12} value={inputName} onChange={setInputName} />
                  <Button
                    isLoading={loading || !account}
                    onClick={onSetName}
                    variant="primary"
                    disabled={loading || inputName.length === 0}
                  >
                    Set Name
                  </Button>
                </div>
              )}
            </div>
            <div className="flex space-x-2 py-2">
              <ListSelect
                title="Active Account: "
                options={list().map((account) => ({
                  id: account.address,
                  label: <div className="w-[225px] text-left">{displayAddress(account.address)}</div>,
                }))}
                value={account.address}
                onChange={select}
              />
              <Button variant={"default"} onClick={create} disabled={isDeploying} isLoading={isDeploying}>
                {isDeploying ? "" : "Create New"}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 opacity-60">
          <Cross
            className="cursor-pointer text-gold fill-gold stroke-gold"
            onMouseLeave={() => {
              setTooltip(null);
              setCopyMessage(null);
            }}
            onMouseEnter={() =>
              setTooltip({
                position: "top",
                content: (
                  <>
                    <p className="whitespace-nowrap">Delete Accounts</p>
                  </>
                ),
              })
            }
            onClick={() => {
              if (window.confirm("Are you sure want to delete all wallets?")) {
                clear();
              }
            }}
          />
          <Copy
            onClick={onCopy}
            onMouseLeave={() => {
              setTooltip(null);
              setCopyMessage(null);
            }}
            className="cursor-pointer text-gold"
          />
          <Import
            onClick={onImportAccount}
            onMouseEnter={() =>
              setTooltip({
                position: "top",
                content: (
                  <>
                    <p className="whitespace-nowrap">Import Account</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => {
              setTooltip(null);
              setImportMessage(null);
            }}
            className="cursor-pointer text-gold"
          />
        </div>
      </div>

      <div className="flex space-x-2 mt-8 justify-center">
        {playerRealms().length > 0 ? (
          <NavigateToRealm text={"begin"} />
        ) : (
          <Button disabled={!name} size="md" className="mx-auto" variant="primary" onClick={onNext}>
            Continue <ArrowRight className="w-2 fill-current ml-3" />
          </Button>
        )}
      </div>
    </StepContainer>
  );
};
export const StepTwo = ({ onPrev }: { onPrev: () => void; onNext: () => void }) => {
  return (
    <StepContainer>
      <div>
        <h3 className="text-center">Select Order</h3>
      </div>

      <SettleRealmComponent />
    </StepContainer>
  );
};

export const StepThree = ({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) => {
  const {
    account: { account },
  } = useDojo();

  const { getAddressName } = useRealm();
  const name = getAddressName(account.address);

  return (
    <StepContainer>
      <ContainerWithSquire>
        <h2 className="mb-4">Welcome {name}...</h2>
        <p className="mb-4">
          Before you begin your Lord, here are some important things you need to understand about this world.
        </p>

        <Button size="md" className="mx-auto" variant="primary" onClick={onNext}>
          Continue <ArrowRight className="w-2 fill-current ml-3" />
        </Button>
      </ContainerWithSquire>
    </StepContainer>
  );
};

export const StepFour = ({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) => {
  return (
    <StepContainer>
      <ContainerWithSquire>
        <h2 className="mb-4">Everything is fungible...</h2>

        <p className="mb-4 text-xl">Resources, Troops, Donkeys all exist and are tradable until you use them...</p>

        <Button size="md" className="mx-auto" variant="primary" onClick={onNext}>
          next <ArrowRight className="w-2 fill-current ml-3" />
        </Button>
      </ContainerWithSquire>
    </StepContainer>
  );
};

export const ContainerWithSquire = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="gap-10 grid grid-cols-12">
      <div className="rounded-full border  self-center col-span-4">
        <img src="/images/buildings/thumb/squire.png" className="rounded-full border" alt="" />
      </div>
      <div className="col-span-8">{children}</div>
    </div>
  );
};

export const StepFive = ({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) => {
  return (
    <StepContainer>
      <ContainerWithSquire>
        <div>
          <h2 className="mb-4">Eternum runs in 15 minute cycles</h2>
          <p className="mb-4 text-xl">
            Your villagers and troops all work on a 15 minute cycle. Act accordingly and plan your moves wisely.
          </p>
          <Button size="md" className="mx-auto" variant="primary" onClick={onNext}>
            Continue <ArrowRight className="w-2 fill-current ml-3" />
          </Button>
        </div>
      </ContainerWithSquire>
    </StepContainer>
  );
};

export const StepSix = ({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) => {
  return (
    <StepContainer>
      <p className="leading-loose text-2xl text-center mb-8">They who rule the Earthenshards rule the world...</p>
      <div className="flex w-full justify-center">
        <NavigateToRealm text={"begin"} showWalkthrough={true} />
      </div>
    </StepContainer>
  );
};

export const NavigateToRealm = ({ text, showWalkthrough = false }: { text: string; showWalkthrough?: boolean }) => {
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const [_location, setLocation] = useLocation();
  const { playerRealms } = useEntities();
  const { setIsOpen } = useTour();
  return (
    <Button
      size="md"
      variant="primary"
      onClick={() => {
        showBlankOverlay(false);
        setLocation(`/hex?col=${playerRealms()[0]?.position.x}&row=${playerRealms()[0]?.position.y}`);
        setIsOpen(showWalkthrough);
      }}
    >
      {text}
    </Button>
  );
};
