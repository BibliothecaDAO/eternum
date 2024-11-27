import { displayAddress } from "@/lib/utils";
import ControllerConnector from "@cartridge/connector/controller";
import { useConnect } from "@starknet-react/core";
import { TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, ButtonProps } from "../ui/button";

export const CartridgeConnectButton = (
  props: ButtonProps & { cartridgeAddress?: string; setCartridgeAddress?: (address: string | undefined) => void },
) => {
  const { connectors } = useConnect();
  const [username, setUsername] = useState<string>();
  const controller = connectors[0] as ControllerConnector;
  const controllerAddress = controller?.controller.account?.address;

  const connectCartridge = async () => {
    try {
      const res = await controller.connect({ chainIdHint: 1n });
      if(res.account){
      props.setCartridgeAddress?.(res.account);
    }
    } catch (e) {
      console.log(e);
    }
  };
  const disconnectCartridge = () => {
    connectors[0].disconnect();
    props.setCartridgeAddress?.(undefined);
  };
  useEffect(() => {
    if (!controllerAddress) return;
    controller.username()?.then((n) => setUsername(n));
  }, [controllerAddress, controller]);

  return (
    <>
      {controllerAddress ? (
        <div className="text-left">
          <div className="flex items-center justify-between">
            <div className="mr-6">Minting to:</div>
            <div className="flex items-center">
              <div className="flex flex-col mr-4">
                <span className="text-lg">{username}</span>
                <span>{displayAddress(controllerAddress)}</span>
              </div>
              <div>
                <Button variant="outline" className="p-2" onClick={() => disconnectCartridge()}>
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="cta" onClick={() => connectCartridge() /*connect({ connector: connectors[0] */} {...props}>
          <img className="w-6" src={connectors[0].icon as string} /> {props.children ?? "Log In"}
        </Button>
      )}
    </>
  );
};
