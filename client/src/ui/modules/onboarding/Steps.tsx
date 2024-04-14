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
import { ReactComponent as ArrowLeft } from "@/assets/icons/common/arrow-left.svg";
import { useRealm } from "@/hooks/helpers/useRealm";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useEntities } from "@/hooks/helpers/useEntities";

export const StepContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      className="flex justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, y: 20 }}
      exit={{ opacity: 0 }}
      transition={{ type: "ease-in-out", stiffness: 3, duration: 0.2 }}
    >
      <div className="self-center bg-brown/80 p-8 text-gold sharp-corners min-w-[800px] max-w-[800px] rounded border-2 border-gold backdrop-blur-lg ">
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
        <h2 className="">
          The Age Of Exploration <br /> has <span className="text-white">begun</span>....
        </h2>
      </div>
      <div className="flex space-x-2 mt-8 justify-center">
        <Button size="md" className="mx-auto" variant="primary" onClick={onNext}>
          Choose your Leader
          <ArrowRight className="w-2 ml-2" />
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

  const { setTooltip } = useUIStore((state) => state);

  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [inputName, setInputName] = useState("");

  const { loading, setLoading, addressName, setAddressName } = useAddressStore();

  const { getAddressName } = useRealm();

  const name = getAddressName(account.address);

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
      <div className="flex flex-col items-center p-3">
        <h3>Select Account</h3>
        {/* <Avatar src={`/images/avatars/${addressToNumber(account.address)}.png`} size="xxl" /> */}
        <div className="flex space-x-6 pt-4">
          <div>
            <div className=" border-gold border p-2 w-full">
              {loading ? (
                <span>Loading...</span>
              ) : addressName ? (
                <span>{addressName}</span>
              ) : (
                <div className="flex w-full">
                  <TextInput placeholder="Your Name..." maxLength={12} value={inputName} onChange={setInputName} />
                  <Button
                    isLoading={loading}
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
              <Button variant={"primary"} onClick={create} disabled={isDeploying} isLoading={isDeploying}>
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
      {
        <div className="flex space-x-2 mt-8 justify-center">
          <Button size="md" className="mx-auto" variant="primary" onClick={onNext}>
            <ArrowRight className="w-2" />
          </Button>
        </div>
      }
    </StepContainer>
  );
};
export const StepTwo = ({ onPrev }: { onPrev: () => void; onNext: () => void }) => {
  return (
    <StepContainer>
      <SettleRealmComponent />
      <div className="flex space-x-2 mt-8 justify-start">
        <Button variant="outline" onClick={onPrev}>
          <ArrowLeft className="w-2" />
        </Button>
      </div>
    </StepContainer>
  );
};

export const StepThree = () => {
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const [_location, setLocation] = useLocation();
  const { playerRealms } = useEntities();
  return (
    <StepContainer>
      <p className="leading-loose text-2xl text-center">
        In a world shadowed by the ruins of hyperstructures, the Orders face the grim task of rebuilding from the ashes.
      </p>
      <div className="flex w-full justify-center">
        <Button
          size="md"
          variant="primary"
          onClick={() => {
            showBlankOverlay(false);
            setLocation(`/hex?col=${playerRealms()[0]?.position.x}&row=${playerRealms()[0]?.position.y}`);
          }}
        >
          begin
        </Button>
      </div>
    </StepContainer>
  );
};
