import { ConnectButton } from "@rainbow-me/rainbowkit";

export const EthereumConnect = ({ label }: { label?: string }) => {
  return (
    <ConnectButton
      label={label ?? "Connect Ethereum Wallet"}
      showBalance={false}
    />
  );
};
