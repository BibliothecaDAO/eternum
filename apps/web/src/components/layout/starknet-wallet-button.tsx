import { useState } from "react";
import { useStarknetWallet } from "@/hooks/use-starknet-wallet";
import { getConnectorIcon } from "@/utils/connectWallet";
import { cn } from "@/utils/utils";
import { ArrowDownIcon, ChevronDownIcon, WalletMinimal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

export const StarknetWalletButton = ({
  className,
  label,
  variant = "default",
  pickerMode,
}: {
  className?: string;
  label?: string;
  autoConnect?: boolean;
  variant?: "default" | "reference";
  pickerMode?: "dropdown" | "sheet";
}) => {
  const { lastConnector, openWalletModal, connectWallet, connectors } = useStarknetWallet();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const primaryConnector = lastConnector ?? connectors.at(0);
  const hasConnectorPicker = connectors.length > 1;
  const isReferenceVariant = variant === "reference";
  const resolvedPickerMode = pickerMode ?? (variant === "reference" ? "sheet" : "dropdown");
  const pickerTriggerClassName = isReferenceVariant
    ? "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground"
    : "inline-flex h-7 w-7 items-center justify-center rounded-md text-primary-foreground/80 transition hover:bg-primary-foreground/10";

  const connectPrimary = () => {
    if (primaryConnector) {
      void connectWallet(primaryConnector);
      return;
    }
    void openWalletModal();
  };

  const connectFromPicker = (connector: (typeof connectors)[number]) => {
    void connectWallet(connector).finally(() => setIsPickerOpen(false));
  };

  const pickerSheet = (
    <Sheet open={isPickerOpen} onOpenChange={setIsPickerOpen}>
      <SheetTrigger asChild>
        <button type="button" className={pickerTriggerClassName} onClick={(e) => e.stopPropagation()}>
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md border-l p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-xl">Connect a wallet</SheetTitle>
        </SheetHeader>

        <div className="max-h-[calc(100svh-5rem)] space-y-3 overflow-y-auto px-4 py-4">
          {connectors.map((connector) => {
            const isRecent = connector.name === lastConnector?.name;
            return (
              <button
                key={connector.name}
                type="button"
                onClick={() => connectFromPicker(connector)}
                className="flex w-full items-center justify-between rounded-xl border bg-card px-3 py-3 text-left transition hover:bg-accent"
              >
                <span className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <img className="h-5 w-5" src={getConnectorIcon(connector)} />
                  </span>
                  <span className="text-sm font-medium">{connector.name}</span>
                </span>
                {isRecent ? (
                  <span className="rounded-full bg-primary/20 px-2.5 py-1 text-xs font-medium text-primary">
                    Recently used
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );

  if (variant === "reference") {
    return (
      <div className={cn("relative w-full", className)}>
        <Button
          onClick={connectPrimary}
          variant="outline"
          className="h-14 w-full justify-start rounded-2xl px-3 pr-16 shadow-sm"
        >
          <span className="mr-3 inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted">
            {lastConnector ? (
              <img className="h-4 w-4" src={getConnectorIcon(lastConnector)} />
            ) : (
              <WalletMinimal className="h-4 w-4 text-primary" />
            )}
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-foreground text-base font-semibold">{label ?? "Connect wallet"}</span>
            <span className="text-muted-foreground text-xs">
              {lastConnector ? `Previously used ${lastConnector.name}` : "Choose a Starknet wallet"}
            </span>
          </span>
        </Button>

        {hasConnectorPicker ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2" onClick={(e) => e.stopPropagation()}>
            {pickerSheet}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Button onClick={connectPrimary} className={`rounded px-2.5 ${className}`}>
      <div className="flex items-center">
        {lastConnector ? <img className="w-7 pr-2" src={getConnectorIcon(lastConnector)} /> : null}
        <p className="mx-auto">{label ?? "Connect wallet"}</p>
        {hasConnectorPicker ? (
          <>
            <Separator orientation="vertical" className="ml-3 mr-1.5 h-6" />

            {resolvedPickerMode === "sheet" ? (
              <div onClick={(e) => e.stopPropagation()}>{pickerSheet}</div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="hover:bg-background/20 p-1" onClick={(e) => e.stopPropagation()}>
                    <ArrowDownIcon width="18" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {connectors.map((connector) => (
                    <DropdownMenuItem
                      key={connector.name}
                      onClick={(e) => {
                        e.stopPropagation();
                        connectFromPicker(connector);
                      }}
                    >
                      <img className="mr-2 h-4 w-4" src={getConnectorIcon(connector)} />
                      {connector.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        ) : null}
      </div>
    </Button>
  );
};
