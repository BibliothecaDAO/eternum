import { shortenAddress, shortenName } from "@/utils/utils";
import { useStarkName as useStarkNameReact } from "@starknet-react/core";

export function useStarkDisplayName(address?: `0x${string}`): string {
  const { data: domain } = useStarkNameReact({ address });
  const shortened = domain
    ? shortenName(domain)
    : address
      ? shortenAddress(address)
      : "none";

  return shortened;
}
