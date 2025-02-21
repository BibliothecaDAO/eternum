import EthereumIcon from "@/components/icons/ethereum.svg?react";
import LordsIcon from "@/components/icons/lords.svg?react";
import StarknetIcon from "@/components/icons/starknet.svg?react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { DelegateCardSkeleton } from "../governance/delegate-card-skeleton";

export function HomepageSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-10">
      {/* Realms Count */}
      <div className="mb-4">
        <h2 className="mb-2 text-xl font-semibold">Your Assets</h2>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Realms</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="flex w-full justify-between gap-2">
                <span className="bg-muted h-9 w-20 animate-pulse rounded" />
                <span className="flex items-center gap-2">
                  on <EthereumIcon className="h-6 w-6" /> Ethereum
                </span>
              </p>
              <p className="flex justify-between gap-2">
                <span className="bg-muted h-9 w-20 animate-pulse rounded" />
                <span className="flex items-center gap-2">
                  on <StarknetIcon className="h-6 w-6" /> Starknet
                </span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LordsIcon className="w-8" />
                Lords
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="flex w-full justify-between gap-2">
                <span className="bg-muted h-9 w-20 animate-pulse rounded" />
                <span className="flex items-center gap-2">
                  on <EthereumIcon className="h-6 w-6" /> Ethereum
                </span>
              </p>
              <p className="flex justify-between gap-2">
                <span className="bg-muted h-9 w-20 animate-pulse rounded" />
                <span className="flex items-center gap-2">
                  on <StarknetIcon className="h-6 w-6" /> Starknet
                </span>
              </p>
              <p className="flex justify-between gap-2">
                <span className="bg-muted h-9 w-20 animate-pulse rounded" />
                <span className="flex items-center gap-2">
                  staked for veLords
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Claimable Lords */}
      <div className="mb-4 md:w-1/2">
        <h2 className="mb-2 text-xl font-semibold">Your Claims</h2>
        <Card>
          <CardHeader>
            <CardTitle>veLords</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Badge className="flex justify-between gap-2 rounded">
              <span className="flex">
                <LordsIcon className="mr-2 w-6" />
                <span className="bg-muted h-9 w-20 animate-pulse rounded" />
              </span>
              <span className="flex items-center gap-2">Realms Emissions</span>
            </Badge>
            <Badge className="flex justify-between gap-2 rounded">
              <span className="flex">
                <LordsIcon className="mr-2 w-6" />
                <span className="bg-muted h-9 w-20 animate-pulse rounded" />
              </span>
              <span className="flex items-center gap-2">
                from veLords staking
              </span>
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Delegate Profile */}
      <div>
        <h2 className="mb-2 text-xl font-semibold">Your Delegate</h2>
        <div className="flex flex-col gap-4">
          <DelegateCardSkeleton />
        </div>
      </div>

      {/* Recent Proposals */}
      <div className="mb-4">
        <h2 className="mb-2 text-xl font-semibold">Recent Proposals</h2>
        <Card className="flex flex-col">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-b p-4 last:border-0">
              <div className="bg-muted h-6 w-3/4 animate-pulse rounded" />
              <div className="bg-muted mt-2 h-4 w-1/2 animate-pulse rounded" />
            </div>
          ))}
          <CardFooter className="mt-2 flex justify-end">
            <Button variant="outline" size="sm" disabled>
              View All
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
