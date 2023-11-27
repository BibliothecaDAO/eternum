import { useEffect, useMemo, useState } from "react";
import Button from "../../../elements/Button";
import useUIStore from "../../../hooks/store/useUIStore";
import SettleRealmComponent from "../../../components/cityview/realm/SettleRealmComponent";
import { useAddressStore, useFetchAddressName } from "../../../hooks/store/useAddressStore";
import { useDojo } from "../../../DojoContext";
import TextInput from "../../../elements/TextInput";
import ListSelect from "../../../elements/ListSelect";
import { addressToNumber, displayAddress } from "../../../utils/utils";
import { ReactComponent as Copy } from "../../../assets/icons/common/copy.svg";
import { ReactComponent as Import } from "../../../assets/icons/common/import.svg";
import { ReactComponent as Cross } from "../../../assets/icons/common/cross.svg";
import Avatar from "../../../elements/Avatar";
export const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(1);

  const nextStep = () => setCurrentStep(currentStep + 1);
  const prevStep = () => setCurrentStep(currentStep - 1);
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);

  const step_headings = [
    "",
    "The Battle of the orders has begun....",
    "Choose Your Leader",
    "Choose Your Allegiance",
    "",
  ];
  return (
    <div className="relative h-screen w-screen">
      <img className="absolute h-screen w-screen object-cover" src="/images/cover.png" alt="" />
      <div className="absolute z-10 w-screen h-screen flex justify-center flex-wrap self-center ">
        <div className="self-center bg-black/80 p-6 rounded-2xl w-1/2  border-gold border text-gold">
          <div className="w-full text-center pt-6">
            <h1 className="">{step_headings[currentStep]}</h1>
          </div>
          <div className=" pb-6 px-6 text-center text-xl">
            {currentStep === 1 && <StepOne onNext={nextStep} />}
            {currentStep === 2 && <Naming onNext={nextStep} />}
            {currentStep === 3 && <StepTwo onPrev={prevStep} onNext={nextStep} />}
            {currentStep === 4 && <StepThree onPrev={prevStep} />}
          </div>
          {currentStep === 4 && (
            <div className="flex w-full justify-center">
              <Button className="mx-auto" variant="outline" onClick={() => showBlankOverlay(false)}>
                begin
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StepOne = ({ onNext }) => {
  return (
    <div>
      <p className="leading-loose pt-4">
        Amidst the ruins of colossal hyperstructures, the Orders bear the grim task of reconstruction in a world
        forgotten by time. Here, unity is overshadowed by survival, as factions vie to forge empires from the remnants
        of a shattered past.
      </p>
      <div className="flex space-x-2 mt-8 justify-center">
        <Button size="md" className="mx-auto" variant="outline" onClick={onNext}>
          Select My Allegiance
        </Button>
      </div>
    </div>
  );
};

const Naming = ({ onNext }) => {
  const {
    account: { create, isDeploying, list, account, select, clear },
    setup: {
      systemCalls: { set_address_name },
    },
  } = useDojo();

  const setTooltip = useUIStore((state) => state.setTooltip);

  const [importMessage, setImportMessage] = useState(null);
  const [copyMessage, setCopyMessage] = useState(null);
  const [inputName, setInputName] = useState("");

  const { loading, setLoading, addressName, setAddressName } = useAddressStore();
  useFetchAddressName(account.address);

  const onSetName = async () => {
    setLoading(true);
    await set_address_name({ name: inputName, signer: account });
    setAddressName(inputName);
    setLoading(false);
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
        let currentBurners = localStorage.getItem("burners") ? JSON.parse(localStorage.getItem("burners")) : {};

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

  const isWalletSelected = useMemo(() => account.address !== import.meta.env.VITE_KATANA_ACCOUNT_1_ADDRESS!, [account]);

  useEffect(() => {
    if (list().length == 0) {
      create();
    }
  }, [isWalletSelected]);

  // useEffect(() => {
  //   setShowBlurOverlay(showSignupPopup);
  // }, [showSignupPopup]);

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
  }, [copyMessage, importMessage]); // This effect runs whenever copyMessage changes.

  return (
    <div>
      <div className="flex flex-col items-center p-3">
        <div className="flex space-x-6 pt-4">
          <Avatar src={`/images/avatars/${addressToNumber(account.address)}.png`} size="xxl" />
          <div>
            <div className="flex flex-cols items-center justify-center mb-2 space-x-2">
              {(loading || addressName) && (
                <span className="text-white border-gold border text-xs rounded-lg p-2">
                  {addressName ? `👑 ${addressName}` : ""}
                </span>
              )}
              {!loading && !addressName && (
                <TextInput
                  placeholder="Your Name..."
                  className={"border border-gold"}
                  maxLength={12}
                  value={inputName}
                  onChange={setInputName}
                />
              )}
              {!(loading || addressName) && (
                <Button
                  isLoading={loading}
                  onClick={onSetName}
                  variant={"outline"}
                  disabled={loading || addressName !== undefined}
                >
                  Set Name
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              <ListSelect
                title="Active Account: "
                options={list().map((account) => ({
                  id: account.address,
                  label: displayAddress(account.address),
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
        <Button size="md" className="mx-auto" variant="outline" onClick={onNext}>
          Select My Allegiance
        </Button>
      </div>
    </div>
  );
};
const StepTwo = ({ onPrev, onNext }) => {
  return (
    <div>
      <SettleRealmComponent />
      <div className="flex space-x-2 mt-8 justify-end">
        <Button variant="outline" onClick={onPrev}>
          Back
        </Button>
        <Button variant="outline" onClick={onNext}>
          continue
        </Button>
      </div>
    </div>
  );
};

const StepThree = ({ onPrev }) => (
  <div>
    <p className="leading-loose">
      In a world shadowed by the ruins of hyperstructures, the Orders face the grim task of rebuilding from the ashes.
    </p>
  </div>
);
