import { StarknetProvider } from "@/hooks/context/starknet-provider";
import { IdentityLogin } from "@/ui/modules/identity/identity-login";

/** The account page's wallet connectors, loaded only when a signed-in player links a wallet. */
export default function WalletLink() {
  return (
    <StarknetProvider>
      <IdentityLogin mode="link" className="items-start" />
    </StarknetProvider>
  );
}
