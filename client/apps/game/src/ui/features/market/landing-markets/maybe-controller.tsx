import { useMemo } from "react";

import { useOptionalControllers } from "@/pm/hooks/controllers/use-controllers";
import { shortAddress } from "@/pm/utils";

export function MaybeController({
  address,
  className,
  showAddress = true,
  ...props
}: {
  address: string;
  className?: string;
  showAddress?: boolean;
}) {
  const controllers = useOptionalControllers();

  const fallbackLabel = useMemo(() => {
    try {
      return shortAddress(address);
    } catch {
      return address;
    }
  }, [address]);

  const label = useMemo(() => {
    const controllerByAddress = controllers?.findController(address);
    if (controllerByAddress) {
      return showAddress ? `${controllerByAddress.username} (${shortAddress(address)})` : controllerByAddress.username;
    }

    const controllerByUsername = controllers?.findControllerByUsername(address);
    if (controllerByUsername) {
      const resolvedAddress = controllers?.findControllerAddressByUsername(address) ?? controllerByUsername.address;
      return showAddress
        ? `${controllerByUsername.username} (${shortAddress(resolvedAddress)})`
        : controllerByUsername.username;
    }

    return fallbackLabel;
  }, [address, controllers, fallbackLabel, showAddress]);

  return (
    <div className={className} {...props}>
      {label}
    </div>
  );
}
