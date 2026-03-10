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

  const label = useMemo(() => {
    const controller = controllers?.findController(address);
    if (controller) {
      return showAddress ? `${controller.username} (${shortAddress(address)})` : controller.username;
    }
    try {
      return shortAddress(address);
    } catch {
      return address;
    }
  }, [address, controllers, showAddress]);

  return (
    <div className={className} {...props}>
      {label}
    </div>
  );
}
