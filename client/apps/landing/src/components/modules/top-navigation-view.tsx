import { displayAddress } from "@/lib/utils";
import ControllerConnector from "@cartridge/connector/controller";
import { useAccount } from "@starknet-react/core";
import { ArrowDownUp, ChevronDown, CoinsIcon, LogIn, LogOut, PlayIcon, Sparkles, Wallet } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { SidebarTrigger } from "../ui/sidebar";
import { ModeToggle } from "./mode-toggle";
import { SeasonStartTimer } from "./season-start-timer";

interface TopNavigationViewProps {
  lordsBalance: bigint;
  onMintTestLords: () => Promise<void>;
  connectors: any[];
  onConnect: (connector: any) => void;
  onDisconnect: () => void;
  accountAddress?: string;
}

export const TopNavigationView = ({
  lordsBalance,
  onMintTestLords,
  connectors,
  onConnect,
  onDisconnect,
}: TopNavigationViewProps) => {
  const { address, connector, isConnected } = useAccount();

  const chain = import.meta.env.VITE_PUBLIC_CHAIN;
  const isSepolia = chain === "sepolia";

  const playUrl = isSepolia ? "https://dev.eternum.realms.world" : null;
  const playLabel = "Play Eternum (Sepolia)";

  const formattedLords = (lordsBalance / 10n ** 18n).toLocaleString("en-US");

  const handleOpenPlay = () => {
    if (!playUrl) return;
    window.open(playUrl, "_blank");
  };

  const handleOpenSwap = () => {
    const baseUrl = "https://app.ekubo.org/?outputCurrency=LORDS&amount=&inputCurrency=ETH";
    window.open(baseUrl, "_blank");
  };

  const handleOpenBridge = () => {
    const baseUrl =
      "https://app.rhino.fi/bridge?mode=receive&chainIn=ARBITRUM&chainOut=STARKNET&tokenOut=ETH&token=ETH&recipient=";
    const userAddress = address || "";
    window.open(baseUrl + userAddress, "_blank");
  };

  const handleOpenControllerInventory = () => {
    if (connector?.id === "controller") {
      (connector as unknown as ControllerConnector).controller.openProfile("inventory");
    }
  };

  const handleDisconnect = () => {
    onDisconnect();
  };

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3 px-3 py-2">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <ModeToggle />
        {isSepolia && (
          <Button variant="cta" size="sm" onClick={handleOpenPlay} className="gap-2 px-4">
            <PlayIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{playLabel}</span>
            <span className="sm:hidden">Play</span>
          </Button>
        )}
      </div>

      <div className="order-3 w-full lg:order-none lg:flex lg:flex-1 lg:justify-center">
        <div className="mx-auto max-w-full lg:max-w-none">
          <SeasonStartTimer />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-primary/40 bg-background/80 px-3 py-1 text-sm text-primary">
          {formattedLords}
          <ResourceIcon size="sm" resource="Lords" className="h-4 w-4" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2 rounded-full px-3">
              <Wallet className="h-4 w-4" />
              {isConnected && address ? (
                <span className="text-sm font-medium">{displayAddress(address)}</span>
              ) : (
                <span className="text-sm font-medium">Connect Wallet</span>
              )}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[220px]">
            <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
            <DropdownMenuItem onSelect={handleOpenSwap}>
              <ArrowDownUp className="h-4 w-4" /> Swap on Ekubo
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleOpenBridge}>
              <CoinsIcon className="h-4 w-4" /> Bridge via Rhino.fi
            </DropdownMenuItem>
            {isSepolia && (
              <DropdownMenuItem
                disabled={!isConnected}
                onSelect={() => {
                  if (!isConnected) return;
                  void onMintTestLords();
                }}
              >
                <Sparkles className="h-4 w-4" /> Mint test LORDS
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {isConnected ? (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Balance</DropdownMenuLabel>
                <DropdownMenuItem disabled>
                  <span className="flex items-center gap-2 text-sm">
                    {formattedLords}
                    <ResourceIcon size="sm" resource="Lords" className="h-4 w-4" />
                  </span>
                </DropdownMenuItem>
                {connector?.id === "controller" && (
                  <DropdownMenuItem onSelect={handleOpenControllerInventory}>
                    <LogIn className="h-4 w-4" /> Open Cartridge Inventory
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={handleDisconnect}>
                  <LogOut className="h-4 w-4" /> Disconnect
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">Connect with</DropdownMenuLabel>
                {connectors.map((walletConnector, index) => {
                  const icon =
                    typeof walletConnector.icon === "string" ? walletConnector.icon : walletConnector.icon?.dark;
                  const name = walletConnector.name ?? `Wallet ${index + 1}`;

                  return (
                    <DropdownMenuItem key={walletConnector.id ?? index} onSelect={() => onConnect(walletConnector)}>
                      {icon ? <img src={icon} alt="" className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                      {name}
                    </DropdownMenuItem>
                  );
                })}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
