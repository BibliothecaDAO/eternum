import { Separator } from "@radix-ui/react-separator";
import { SidebarTrigger, useSidebar } from "../ui/sidebar";
import { Breadcrumbs } from "./breadcrumbs";
import { StarknetWalletButton } from "./starknet-wallet-button";
import { useAccount } from "@starknet-react/core";
import { Button } from "../ui/button";
import { cn, shortenAddress } from "@/utils/utils";
import { ModeToggle } from "./mode-toggle";
import { Link } from "@tanstack/react-router";
import RWLogo from "@/components/icons/rw-logo.svg";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export function Header() {
  const { address } = useAccount();
  const { open } = useSidebar();
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
            <Popover>
              <PopoverTrigger asChild>
                <Button>{shortenAddress(address)}</Button>
              </PopoverTrigger>
              <PopoverContent>
                <div className="flex flex-col gap-2">
                  <div className="flex">{shortenAddress(address)}</div>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <StarknetWalletButton />
          )}
        </div>
      </div>
    </header>
  );
}
