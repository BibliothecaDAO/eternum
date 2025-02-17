import React, { useState } from "react";
import StarknetIcon from "@/components/icons/starknet.svg?react";
import { StarknetWalletButton } from "@/components/layout/starknet-wallet-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAccount, useSignTypedData } from "@starknet-react/core";
import { Payload as SIWPayload, SIWWeb3 } from "@web3auth/sign-in-with-web3";
import { env } from "env";
import { hash, TypedData } from "starknet";

const Starkware: React.FC = () => {
  const { isConnected, address } = useAccount();
  //const [provider, setProvider] = useState<any>();
  const [siwsMessage, setSiwsMessage] = useState<SIWWeb3 | null>();
  const [sign, setSignature] = useState("");

  let typedMessage;
  const domain = window.location.host;
  const origin = window.location.origin;
  let statement = "Sign in to Realm";

  const { isError, isPending, data, error, signTypedDataAsync } =
    useSignTypedData({});

  const signMessage = async (message: TypedData) => {
    console.log("signMessage", message);
    //message = hash.starknetKeccak(message).toString().substring(0, 31);

    typedMessage = {
      domain: {
        name: "Realms.World Account Portal",
        chainId: env.VITE_PUBLIC_CHAIN == "mainnet" ? "SN_MAIN" : "SN_GOERLI",
        version: "0.0.1",
        revision: "1",
      },
      types: {
        StarkNetDomain: [
          { name: "name", type: "felt" },
          { name: "chainId", type: "felt" },
          { name: "version", type: "felt" },
          { name: "revision", type: "string" },
        ],
        Message: [
          { name: "address", type: "felt" },
          { name: "statement", type: "string" },
          { name: "uri", type: "string" },
          { name: "nonce", type: "string" },
          { name: "issuedAt", type: "string" },
          { name: "version", type: "felt" },
        ],
      },
      primaryType: "Message",
      message: {
        message,
      },
    };

    console.log("typedMessage", typedMessage);

    return signTypedDataAsync(typedMessage);
  };

  async function createStarkwareMessage() {
    const payload = new SIWPayload();
    payload.domain = domain;
    payload.address = address as string;
    payload.uri = origin;
    payload.statement = statement;
    payload.version = "1";
    payload.chainId = 1;
    const header = {
      t: "eip191",
    };
    const network = "starkware";
    let message = new SIWWeb3({ header, payload, network });
    setSiwsMessage(message);
    const messageText = message.prepareMessage();
    const result = await signMessage(messageText);
    setSignature(result.join(","));
  }

  return (
    <>
      {isConnected && sign == "" && (
        <span>
          <p className="text-center">Sign Transaction</p>
          <Input type="text" id="publicKey" value={address} readOnly />
        </span>
      )}
      {isConnected != true && sign == "" && (
        <div className="flex items-center gap-2">
          <StarknetIcon className="h-10 w-10" />
          <p className={"text-2xl"}>Sign in With Starkware</p>
        </div>
      )}

      {isConnected && sign == "" && (
        <div>
          <Button id="w3aBtn" onClick={createStarkwareMessage}>
            Sign-in with Starkware
          </Button>
        </div>
      )}
      {isConnected != true && sign == "" && <StarknetWalletButton />}

      {sign && (
        <>
          <p className="text-center">Verify Signature</p>
          <input
            type="text"
            id="signature"
            value={sign}
            onChange={(e) => setSignature(e.target.value)}
          />
          <Button
            id="verify"
            onClick={(e) => {
              const signature = {
                t: "eip191",
                s: sign.split(","),
              };
              const payload = siwsMessage!.payload;
              siwsMessage!
                .verify(payload, signature, provider)
                .then((resp) => {
                  if (resp.success == true) {
                    toast({
                      title: "Success",
                      description: "Signature Verified",
                      variant: "default", // adjust the variant if you have specific success styling
                    });
                  } else {
                    toast({
                      title: "Error",
                      description: resp.error.type,
                      variant: "destructive", // for errors
                    });
                  }
                })
                .catch((err) => {
                  console.log(err);
                  toast({
                    title: "Error",
                    description: err.error.toString(),
                    variant: "destructive",
                  });
                });
            }}
          >
            Verify
          </Button>
          <Button
            id="verify"
            onClick={(e) => {
              setSiwsMessage(null);
              setSignature("");
            }}
          >
            Back to Wallet
          </Button>
        </>
      )}
    </>
  );
};

export default Starkware;
