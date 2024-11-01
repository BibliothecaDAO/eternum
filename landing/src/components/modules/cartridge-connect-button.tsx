import { useConnect } from "@starknet-react/core";
import { Button, ButtonProps } from "../ui/button";

export const CartridgeConnectButton = (props: ButtonProps) => {
  const { connect, connectors } = useConnect();

  return (
    <Button variant="cta" onClick={() => connect({ connector: connectors[2] })} {...props}>
      <img className="w-6" src={connectors[2].icon as string} /> Log In
    </Button>
  );
};
