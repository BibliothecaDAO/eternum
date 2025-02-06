import { Separator } from "@radix-ui/react-separator";
import { SidebarTrigger, useSidebar } from "../ui/sidebar";
import { Breadcrumbs } from "./breadcrumbs";
import { StarknetWalletButton } from "./starknet-wallet-button";
import { useAccount, useDisconnect, useExplorer } from "@starknet-react/core";
import { Button } from "../ui/button";
import { cn, shortenAddress } from "@/utils/utils";
import { ModeToggle } from "./mode-toggle";
import { Link } from "@tanstack/react-router";

import RWLogo from "@/components/icons/rw-logo.svg?react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Avatar, AvatarImage } from "../ui/avatar";
import { Check, Copy, ExternalLink, Unplug } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function Header() {
  const { address } = useAccount();
  const { open } = useSidebar();
  const { disconnect } = useDisconnect();
  const explorer = useExplorer();
  return (
    <header
      className={cn(
        "flex sticky  z-50 top-0 shrink-0 items-center transition-[width,height] ease-linear  border-b bg-sidebar"
      )}
    >
      <div className="flex w-full gap-2 h-(--header-height)">
        <div
          className={
            `${open ? "w-(--sidebar-width)" : "w-(--sidebar-width-icon)"}` +
            " border-r flex items-center justify-center"
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
        <div className="flex justify-between items-center flex-1 px-4">
          <div className="flex justify-between items-center gap-2">
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
                  <Avatar className="size-6 mr-1">
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
                    <Avatar className="size-8 mr-1">
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
        </div>
      </div>
    </header>
  );
}
