import RWLogo from "@/components/icons/rw-logo.svg?react";
import { toast } from "@/hooks/use-toast";
import useIsWrongNetwork from "@/hooks/use-wrong-network";
import { cn, shortenAddress } from "@/utils/utils";
import { Separator } from "@radix-ui/react-separator";
import { useAccount, useDisconnect, useExplorer } from "@starknet-react/core";
import { Link } from "@tanstack/react-router";
import { env } from "env";
import { Check, Copy, ExternalLink, Unplug } from "lucide-react";

import { Avatar, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { SidebarTrigger, useSidebar } from "../ui/sidebar";
import { Breadcrumbs } from "./breadcrumbs";
import { ModeToggle } from "./mode-toggle";
import { StarknetWalletButton } from "./starknet-wallet-button";

export function Header() {
  const { address } = useAccount();
  const { open } = useSidebar();
  const { disconnect } = useDisconnect();
  const explorer = useExplorer();
  const { isWrongNetwork, setIsWrongNetwork } = useIsWrongNetwork();

  return (
    <header
      className={cn(
        "bg-sidebar sticky top-0 z-50 flex shrink-0 items-center border-b transition-[width,height] ease-linear",
      )}
    >
      <div className="h-(--header-height) flex w-full gap-2">
        <div
          className={
            `${open ? "w-(--sidebar-width)" : "w-(--sidebar-width-icon)"}` +
            " flex items-center justify-center border-r"
          }
        >
          <Link to="/">
            <RWLogo
              className={
                `${open ? "w-20" : "w-10"}` +
                " h-auto transition-[width,height] duration-300"
              }
            />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-between px-4">
          <div className="flex items-center justify-between gap-2">
            <SidebarTrigger className="-ml-1" />
            <ModeToggle />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumbs />
          </div>
          {address ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex items-center gap-2 rounded px-3"
                >
                  <Avatar className="mr-1 size-6">
                    <AvatarImage
                      src={`https://api.dicebear.com/6.x/bottts-neutral/svg?seed=${address}`}
                    />
                  </Avatar>
                  {shortenAddress(address)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel className="flex flex-col gap-6 p-4">
                  <div className="flex items-center gap-2">
                    <Avatar className="mr-1 size-8">
                      <AvatarImage
                        src={`https://api.dicebear.com/6.x/bottts-neutral/svg?seed=${address}`}
                      />
                    </Avatar>
                    <div className="text-xl">{shortenAddress(address)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={explorer.contract(address)} target="_blank">
                      <Button
                        variant={"outline"}
                        size="icon"
                        className="rounded-full"
                      >
                        <ExternalLink />
                      </Button>
                    </a>
                    <Button
                      variant={"outline"}
                      size="icon"
                      className="rounded-full"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(address);
                        } catch (error) {
                          console.error("Failed to copy address:", error);
                        }
                        toast({
                          description: (
                            <div className="flex items-center gap-2">
                              <Check className="text-green-500" />
                              <span>Address copied to clipboard</span>
                            </div>
                          ),
                        });
                      }}
                    >
                      <Copy />
                    </Button>
                    <Button
                      variant={"outline"}
                      className="rounded-full"
                      onClick={() => disconnect()}
                    >
                      <Unplug /> Disconnect
                    </Button>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <StarknetWalletButton />
          )}
          <Dialog open={isWrongNetwork}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Wrong Network</DialogTitle>
              </DialogHeader>
              <DialogDescription>
                You are on the wrong network. Please switch to{" "}
                {env.VITE_PUBLIC_CHAIN}
              </DialogDescription>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
