import { SecondaryPopup } from "../elements/SecondaryPopup";
import { Headline } from "../elements/Headline";
import Button from "../elements/Button";
import { useEffect, useMemo, useState } from "react";
import useUIStore from "../hooks/store/useUIStore";
import { useDojo } from "../DojoContext";
import { displayAddress } from "../utils/utils";
import ListSelect from "../elements/ListSelect";
import { ReactComponent as Copy } from "../assets/icons/common/copy.svg";
import { ReactComponent as Import } from "../assets/icons/common/import.svg";
import TextInput from "../elements/TextInput";
import { useAddressStore, useFetchAddressName } from "../hooks/store/useAddressStore";

type SignUpComponentProps = {
  isWorldLive: boolean;
  worldLoading: boolean;
  worldProgress: number;
};

export const SignUpComponent = ({ isWorldLive, worldLoading, worldProgress }: SignUpComponentProps) => {
  const {
    account: { create, isDeploying, list, account, select, clear },
    setup: {
      systemCalls: { set_address_name },
    },
  } = useDojo();

  const [showSignupPopup, setShowSignupPopup] = useState(true);
  const setShowBlurOverlay = useUIStore((state) => state.setShowBlurOverlay);
  const toggleSound = useUIStore((state) => state.toggleSound);
  const setTooltip = useUIStore((state) => state.setTooltip);

  // import export account
  const [importMessage, setImportMessage] = useState(null);
  const [copyMessage, setCopyMessage] = useState(null);
  const [inputName, setInputName] = useState("");

  const { loading, setLoading, addressName, setAddressName } = useAddressStore();
  useFetchAddressName(account.address);

  // useEffect(() => {
  //   const fetchName = async () => {
  //     const name = await fetchAddressName(account.address);
  //     if (name) {
  //       setCurrentName(hexToAscii(name));
  //       setHasName(true);
  //     } else {
  //       setHasName(false);
  //     }
  //   };
  //   fetchName();
  // }, [account.address, loading]);

  let disableStart = false;
  // let disableStart = true;
  // if (import.meta.env.DEV) {
  //   disableStart = false;
  // }

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
    setShowBlurOverlay(showSignupPopup);
  }, [showSignupPopup]);

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
    <SecondaryPopup className="!translate-x-0 !left-auto !top-1/2 !-translate-y-1/2">
      <SecondaryPopup.Head className="!cursor-default">
        <div className="mr-0.5">Sign Up</div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width="400px">
        <div className="flex flex-col items-center p-3">
          <img src="/images/eternum-logo.svg" className=" w-48" alt="Eternum Logo" />
          <img src="/images/cover.png" className="w-full my-3" alt="Eternum Logo" />
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
            <Copy
              onClick={onCopy}
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Export Account</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => {
                setTooltip(null);
                setCopyMessage(null);
              }}
              className="cursor-pointer text-gold"
            ></Copy>
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
            ></Import>
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
          <div className="flex flex-cols m-2 items-center justify-center">
            {/* {(loading || addressName) && (
              <TextInput
                placeholder="Attach Name to Address"
                className={"border !py-1 !my-1 mr-2"}
                value={addressName || ""}
                onChange={() => {}}
              ></TextInput>
            )} */}
            {(loading || addressName) && (
              <span className="text-white border-gold border text-xs rounded-lg p-2">
                {addressName ? `👑 ${addressName}` : ""}
              </span>
            )}
            {!loading && !addressName && (
              <TextInput
                placeholder="Attach Name to Address"
                className={"border !py-1 !my-1 mr-2"}
                maxLength={12}
                value={inputName}
                onChange={setInputName}
              ></TextInput>
            )}
            {!(loading || addressName) && (
              <Button
                isLoading={loading}
                onClick={onSetName}
                className={"!py-2 !my-1"}
                variant={"primary"}
                disabled={loading || addressName !== undefined}
              >
                Set Name
              </Button>
            )}
          </div>
          <Button
            // @note: currently disabled for prod, enable back when new version is ready
            disabled={!isWalletSelected || worldLoading || disableStart || !isWorldLive}
            className="mt-2 !p-2"
            variant={worldLoading || isWalletSelected ? "primary" : "outline"}
            onClick={() => {
              setShowSignupPopup(false);
              if (!localStorage.getItem("soundEnabled") || localStorage.getItem("soundEnabled") === "true") {
                toggleSound();
              }
            }}
          >
            {!isWorldLive
              ? "No World"
              : worldLoading
              ? "World Loading"
              : isWalletSelected
              ? "Start playing"
              : "No wallet selected"}
          </Button>
          {/* Progress text */}
          {worldLoading && (
            <div className="mt-2 text-center text-xs text-white">Loading: {worldProgress.toFixed(2)}%</div>
          )}
          {/* <div className="flex items-center mt-2 mb-1 text-xs text-center text-white">
            <Danger />
            <div className="ml-1 text-danger">Eternum in maintenance. Next update soon.</div>
          </div> */}
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
